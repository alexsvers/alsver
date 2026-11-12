# Cardinal Gaze

An ocular motility trainer. You examine a simulated patient the way you would in clinic
(versions in nine positions, cover test, head tilt, doll's head, convergence) and then
name the lesion.

Open `index.html` in a browser. It is a single self-contained file and works on a phone.

## What is in it

- **Textbook**: 24 conditions, each with the findings, localisation and differential beside the patient.
- **Diagnose**: an unknown patient with a short history. You commit to a diagnosis, a side and a site.
  Scores, streak and per-condition accuracy are kept on the device.
- **Tools**: a gaze pad that moves the fixation light without a finger over the eyes (drag for
  pursuit, tap for a saccade), cover R / cover L, head tilt and doll's head, target distance
  down to the near point, lid lift.
- **Settings**: deviation size, either Clear (larger angles, easy to see on a phone) or
  Realistic (partial palsies and smaller angles).
- **Patient's view**: the target as the patient sees it, one image per eye, with the deviation in prism dioptres.
- **Hess chart** computed from the same model.

Red is the right eye and green is the left eye throughout, as on a Hess screen.

## How the model works

`src/engine.js` is a small, DOM-free simulation with three levels, so that bedside manoeuvres
separate lesions the way they do in real patients:

1. **Supranuclear**: scales voluntary gaze only. The vestibulo-ocular reflex bypasses it,
   so the doll's head manoeuvre overcomes these palsies (Parinaud, PSP).
2. **Nuclear and internuclear**: scales conjugate commands (voluntary and vestibular) but not
   vergence (INO, gaze palsy, one-and-a-half).
3. **Plant**: six muscles per eye with reciprocal innervation, plus elastic mechanical limits
   for restrictive disease.

The fixing eye sets the innervation and the other eye receives the same command (Hering's law).
Primary and secondary deviation, incomitance, the Bielschowsky test and fusion with a
compensatory head posture all fall out of that rather than being scripted per condition.

It is a teaching simulation, not a clinical tool.

## Development

```
node build.mjs              # bundles src/ into index.html (and dist/artifact.html)
node test/engine.test.mjs   # clinical sanity checks for the model, add -v for a nine-gaze table
```

| File | Purpose |
| --- | --- |
| `src/engine.js` | Motility model, time-stepped simulation, Hess computation |
| `src/conditions.js` | Parameters and teaching text for each condition |
| `src/render.js` | The face, painted on a canvas: colour washes, brush texture, grain and fine line work |
| `src/viz.js` | Hess chart and the patient's view |
| `src/app.js` | Screens, tools, quiz, progress |
