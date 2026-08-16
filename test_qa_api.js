import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

async function run() {
  try {
    const ai = new GoogleGenAI({});
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: 'Hello'
    });
    console.log('Success:', res.text);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();
