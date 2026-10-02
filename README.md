# SignBridge AI

An AI-powered sign language learning, training and communication platform.
**Bridging Communication Through AI.**

Understand signs. Learn gestures. Communicate without barriers.

## What it does
- **Live communication** — your camera tracks hand landmarks in real time; a recognised
  sign becomes text and can be spoken aloud.
- **Sign library** — a searchable, filterable library of signs with meanings, categories,
  difficulty and example sentences.
- **Practice mode** — compare your gesture with a target sign and get instant feedback.
- **Communication history** — recognised phrases with replay, copy and delete.
- **Admin training module** — create signs, capture training samples, manage the dataset,
  and see real cross-validated accuracy.

## How recognition works
Hand landmarks (MediaPipe) are normalised so recognition is independent of hand position
and distance, then classified with a k-nearest-neighbours model built from the samples you
capture. Static signs use a single 63-number pose feature; dynamic signs use a short
resampled sequence. The model is kept separate from the UI so a full ML pipeline can
replace it later.

## Honest by design
- The admin gate is **prototype authentication** — client-side only, not real security.
- The AI Training screen is labelled **Prototype Training Mode**. It does **not** fake an
  epoch/loss curve; the accuracy shown is a genuine leave-one-out cross-validation over
  your captured samples.
- Low-confidence gestures are **never** spoken automatically — you can confirm first.
- No camera footage is stored. Only the numeric landmarks you choose to save as training
  samples are kept, in your browser.

## Running it
It is a static site. Open `index.html` over **HTTPS** (the camera requires a secure
context), or serve the folder locally:

    python -m http.server 8000

Then visit http://localhost:8000 — note that camera access on `localhost` works, but on a
phone you need a real HTTPS host (this repo is published with GitHub Pages).

## Privacy
Camera data is processed on-device. Nothing is uploaded.
