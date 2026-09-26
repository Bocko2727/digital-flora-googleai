# AI botanical claims — review list (2026-09-22)

Read-only snapshot of `public.plants` (Supabase `sxuxtsbyqjaodyuqebux`, 98 plants) for the owner to review.
All texts below come from AI analysis (single-upload Gemini or the AI-generated botanical archive), not from a botanist.
Nothing was edited in the database (CLAUDE.md §4.8). The UI now labels these sections „AI текст — непроверен“ (§4.13/§4.14).

Query: `benefits`, `uses`, `risks` matching edibility / toxicity / medicinal keywords → 89 hits (69 risks, 15 uses, 5 benefits).

## A. Positive safety or edibility claims — highest risk, review first
These state or imply that a plant is safe or edible, based only on an AI photo identification.

| Plant | id | Field | Claim (excerpt) |
|---|---|---|---|
| Дълголистна мента | 73718a66 | risks | „Растението е ядливо и се използва като билка и подправка…“ |
| Тлъстига (Дебелец) | e8229cee | risks | „Напълно безопасно растение; сокът има успокояващо действие…“ |
| Червена боровинка | 1a78c0d3 | risks | „Без токсичност; ядливи плодове…“ |
| Черна боровинка | ee9dd698 | risks | „Без токсичност; ядливи плодове…“ |
| Силезийска върба | 3303e9b3 | risks | „Без токсичност; кората съдържа салицин.“ |
| Дива мащерка | d2c7503d | risks | „Безопасна при нормална употреба като билка…“ |
| Обикновена зайча киселица | d9f28a45 | risks | „…често се използва за храна…“ |
| Памуклийка (Скална роза) | 461c2620 | risks | „Растението не е отровно…“ |
| Червено омайниче | 7bbb3fbb | risks | „Растението не се счита за отровно…“ |
| Обикновена комелина | b2ad4c2c | risks | „Не се счита за силно токсично растение…“ |
| Алпийска незабравка | da2605c3 | risks | „Няма известни токсични рискове при контакт…“ |
| Безстъблено плюскавиче | 0c88f435 | risks | „Няма известни токсични свойства за хората.“ |
| Извитолистна минуарция | 46683520 | risks | „Няма известни токсични свойства.“ |
| Космат прелом | 79d8d463 | risks | „Няма известни токсични ефекти…“ |
| Лъжицолистна камбанка | 0ca85cd9 | risks | „Няма известни токсични свойства.“ |
| Пълзяща мишелка | 992c7d6a | risks | „Няма известни токсични рискове при контакт.“ |
| Джуджевиден карамфил | 111d9cf9 | risks | „Няма данни за токсичност.“ |
| Скалоломна петрорагия | 275a035d | risks | „Няма данни за токсичност.“ |
| Чадъреста лихеномфалия (гъба) | e2067a63 | risks | „…няма известни сериозни токсични опасности…“ |

Suggested wording when an editor has not verified a claim: „Няма проверени данни за токсичност. Не консумирайте и не използвайте за лечение без потвърждение от специалист.“

## B. Medicinal or culinary use claims (uses / benefits)
| Plant | id | Field | Claim (excerpt) |
|---|---|---|---|
| Бял оман | aebd03d6 | uses, benefits | отвари, тинктури, сиропи против кашлица; „изключително ценно лечебно растение“ |
| Дива мащерка | d2c7503d | uses, benefits | народна и официална медицина (чай, сиропи); „облекчава кашлица, бронхит“ |
| Горска пищялка | f4441b5f | uses, benefits | чай и тинктури, кулинария; „подпомага храносмилането“ |
| Синя жлъчка (Цикория) | 77944421 | uses | заместител на кафе, листа за салати, фитотерапия |
| Малък зимзелен | 75e9add9 | benefits | винкамин „за подобряване на мозъчното кръвообращение и паметта“ (растението е токсично) |
| Горски спореж | 0ea3368d | uses, benefits | историческа фитотерапия (токсичен — пиролизидинови алкалоиди) |
| Тлъстига (Дебелец) | e8229cee | uses | „пресният сок се капе в ухото при болки“ |
| Медуница | 8c9e7a2a | uses | „традиционна билка при кашлица“ |
| Бодлив залист | 859923f8 | uses | фитотерапия при разширени вени |
| Бодил | 02d490fb | uses | народна медицина, противовъзпалително |
| Вълнест бод | efb79bd0 | uses | народна медицина |
| Лютиче | adc08bcf | uses | народна медицина външно |
| Обикновена вратига | 66f352cd | uses | народна медицина външно |
| Орлови нокти | 004be410 | uses | традиционна китайска медицина |
| Миризлива чемерика | 547787c9 | uses | ветеринарна медицина в миналото |

## C. Warnings (≈50 records)
Texts like „СИЛНО ОТРОВНО“, „Не консумирайте…“, „Идентификацията по снимка е само предварителна…“. These are conservative and lower risk, but they are still AI-generated and carry the label.
Examples: Вълнест напръстник, Едроцветен напръстник, Олеандър, Миризлива чемерика, Малък зимзелен, Горски спореж, Абсинтиева зановеч.

## Suggested next step (needs owner approval — production data change)
For group A, replace the text with the neutral wording above, or have a botanist confirm it.
For group B, keep the text but move it behind the „AI текст — непроверен“ label (already done in the UI) until verified.
