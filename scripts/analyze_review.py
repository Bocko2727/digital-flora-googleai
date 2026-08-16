import base64
import json
import mimetypes
import os
import random
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / 'images' / 'review'
RESULTS = ROOT / 'data' / 'review-results.json'
API_KEY = os.environ.get('GEMINI_API_KEY')
MODEL = 'gemini-3.6-flash'
BATCH_SIZE = int(os.environ.get('GEMINI_REVIEW_BATCH_SIZE', '6'))
MAX_IMAGE_RETRIES = 5
MAX_BATCH_RUNS = int(os.environ.get('GEMINI_MAX_BATCH_RUNS', '2'))
INITIAL_BACKOFF_SECONDS = 5
RETRYABLE_HTTP_CODES = {429, 503}
PROMPT = '''You are a cautious botanical image triage assistant. Analyze ONE image only. Do not infer unseen features. Return valid JSON only with these keys: file, likely_common_name_bg, likely_scientific_name, family, confidence (low|medium|high), visible_features, possible_lookalikes, additional_photos_needed, safety_note, review_status. Use Bulgarian for all descriptive strings. review_status must be needs_human_review. If the organism cannot be determined from the image, state that clearly and keep confidence low. Do not provide medical advice or claim an identification is certain.'''

def now(): return datetime.now(timezone.utc).isoformat()
def load_results(): return json.loads(RESULTS.read_text(encoding='utf-8')) if RESULTS.exists() else {'schema_version': 1, 'items': []}
def retry_runs(item):
    try: return int(item.get('retry_runs', 0))
    except (TypeError, ValueError): return 0
def is_retryable(item):
    error = str(item.get('error', ''))
    return ('HTTP Error 429' in error or 'HTTP Error 503' in error or 'RESOURCE_EXHAUSTED' in error) and retry_runs(item) < MAX_BATCH_RUNS
def analyze(path):
    mime = mimetypes.guess_type(path.name)[0] or 'image/jpeg'
    encoded = base64.b64encode(path.read_bytes()).decode('ascii')
    payload = {'contents': [{'parts': [{'text': PROMPT}, {'inline_data': {'mime_type': mime, 'data': encoded}}]}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.1}}
    request = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}', data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=120) as response: raw = json.loads(response.read().decode('utf-8'))
    item = json.loads(re.sub(r'^```json\s*|\s*```$', '', raw['candidates'][0]['content']['parts'][0]['text'].strip()))
    item.update(file=path.name, analyzed_at=now(), review_status='needs_human_review')
    return item
def analyze_with_retry(path):
    for attempt in range(MAX_IMAGE_RETRIES):
        try: return analyze(path)
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_HTTP_CODES or attempt == MAX_IMAGE_RETRIES - 1: raise
            time.sleep(INITIAL_BACKOFF_SECONDS * (2 ** attempt) + random.uniform(0, 1))
def error_item(path, exc, previous):
    item = {'file': path.name, 'review_status': 'needs_human_review', 'error': f'Автоматичният анализ не завърши: {exc}', 'analyzed_at': now()}
    if isinstance(exc, urllib.error.HTTPError) and exc.code in RETRYABLE_HTTP_CODES: item['retry_runs'] = retry_runs(previous) + 1
    return item
def main():
    if not API_KEY: raise RuntimeError('Missing GEMINI_API_KEY repository secret.')
    data = load_results(); items = data.get('items', []); existing = {item.get('file'): item for item in items}
    candidates = [path for path in sorted(INBOX.glob('*')) if path.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'} and (path.name not in existing or is_retryable(existing[path.name]))][:BATCH_SIZE]
    selected = {path.name for path in candidates}; data['items'] = [item for item in items if item.get('file') not in selected]
    for index, path in enumerate(candidates):
        previous = existing.get(path.name, {})
        if path.stat().st_size > 18 * 1024 * 1024: data['items'].append({'file': path.name, 'review_status': 'needs_human_review', 'error': 'Файлът е по-голям от 18 MB; качи по-малко копие.', 'analyzed_at': now()})
        else:
            try: data['items'].append(analyze_with_retry(path))
            except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc: data['items'].append(error_item(path, exc, previous))
        if index < len(candidates) - 1: time.sleep(5)
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + chr(10), encoding='utf-8')
if __name__ == '__main__': main()
