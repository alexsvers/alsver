/* Cardinal Gaze — the condition catalogue: model parameters and the teaching text for each. */
(function (root) {
  'use strict';
  var CG = (root.CG = root.CG || {});
  var E = CG.engine;

  // Build a config for a lesion on `side`. fn(o, S, O, sg): S = affected eye key, O = the other,
  // sg = +1 when the affected side is the patient's right (the sign of ipsilateral gaze).
  function build(fn) {
    return function (side) {
      var S = side === 'L' ? 'L' : 'R', O = S === 'R' ? 'L' : 'R', sg = S === 'R' ? 1 : -1;
      var o = {};
      fn(o, S, O, sg);
      return E.makeConfig(o);
    };
  }

  function abductingNystagmus(eye, dirX) {
    return {
      type: 'jerk', eye: eye, dirX: dirX, amp: 3.2, freq: 3.4,
      when: function (sol) { return (sol.ver.x * dirX - 8) / 12; }
    };
  }

  var SITES = {
    none: 'No lesion: normal alignment and movement',
    fusion: 'Binocular alignment (comitant squint), no weak muscle',
    vergence: 'Vergence control, no weak muscle',
    cn6: 'Abducens nerve (CN VI) and the lateral rectus',
    cn4: 'Trochlear nerve (CN IV) and the superior oblique',
    cn3: 'Oculomotor nerve (CN III)',
    mlf: 'Medial longitudinal fasciculus',
    pons: 'Pontine gaze centre (PPRF or abducens nucleus)',
    ponsmlf: 'Pontine gaze centre together with the adjacent MLF',
    pretectum: 'Dorsal midbrain (pretectum and posterior commissure)',
    rimlf: 'Supranuclear vertical gaze centres, degenerative',
    otolith: 'Otolith–ocular (utricular) pathway',
    nmj: 'Neuromuscular junction',
    myopathy: 'Extraocular muscle fibres (mitochondrial myopathy)',
    tedmuscle: 'Muscle bellies, enlarged and fibrosed by inflammation',
    floor: 'Inferior rectus tethered in the orbital floor',
    trochlea: 'Superior oblique tendon at the trochlea',
    dysinnervation: 'Absent abducens nucleus, lateral rectus wired to CN III',
    elevators: 'Elevation of one eye (superior rectus, tight inferior rectus or supranuclear)'
  };

  var GROUPS = [
    { id: 'baseline', name: 'Normal and comitant' },
    { id: 'nerve', name: 'Cranial nerve palsies' },
    { id: 'brainstem', name: 'Brainstem: internuclear and supranuclear' },
    { id: 'muscle', name: 'Neuromuscular junction and muscle' },
    { id: 'mechanical', name: 'Restrictive and congenital' }
  ];

  var LIST = [
    {
      id: 'normal', name: 'Normal ocular motility', short: 'Straight eyes, full movements', group: 'baseline',
      sided: false, site: 'none',
      build: build(function (o) { o.fusion = { h: 6, v: 2 }; }),
      history: 'A 30-year-old referred by an optician for “a possible squint”. No symptoms.',
      summary: 'Orthotropic in primary position, with full conjugate versions and no movement on cover testing.',
      signs: [
        'Corneal reflexes are central and symmetric in every position of gaze',
        'No refixation movement on cover–uncover or alternate cover test',
        'Full ductions: in lateral gaze the limbus of the abducting eye reaches the outer canthus',
        'Convergence holds until the target is about 9 cm away',
        'Head tilt and the doll’s head manoeuvre change nothing'
      ],
      localise: 'Nothing to localise. Use this patient to calibrate your eye for normal ranges and saccade speed before moving on.',
      pitfall: 'A wide nasal bridge, epicanthal folds or a large angle kappa can imitate a squint (pseudostrabismus). The reflexes stay symmetric and the cover test shows no movement.'
    },
    {
      id: 'et', name: 'Comitant esotropia', short: 'Convergent squint, same angle everywhere', group: 'baseline',
      sided: false, site: 'fusion',
      build: build(function (o) {
        o.verg = { bias: 16 }; o.fusion = { h: 0, v: 0 }; o.suppression = true; o.fixPref = 'alt';
      }),
      history: 'A 4-year-old whose parents have seen one eye turn in since infancy. The child has never complained of double vision.',
      summary: 'A constant convergent squint whose angle is the same in every direction of gaze and with either eye fixing. This patient alternates fixation freely.',
      signs: [
        'The corneal reflex of the deviating eye sits temporal to the pupil centre',
        'Cover the fixing eye and the other eye moves outward to take up fixation',
        'After uncovering, the eye that was last fixing keeps fixing: free alternation',
        'The angle is the same in right, left, up and down gaze; ductions are full',
        'No diplopia: the deviating eye is suppressed'
      ],
      localise: 'No nerve or muscle is weak. Typical causes are infantile esotropia and accommodative esotropia. Do a cycloplegic refraction and look for amblyopia.',
      pitfall: 'A sixth nerve palsy also gives esotropia, but the angle grows on gaze toward the weak muscle and abduction is limited. Acute comitant esotropia in an older child or adult deserves imaging.'
    },
    {
      id: 'xt', name: 'Comitant exotropia', short: 'Divergent squint, same angle everywhere', group: 'baseline',
      sided: false, site: 'fusion',
      build: build(function (o) {
        o.verg = { bias: -16 }; o.fusion = { h: 0, v: 0 }; o.suppression = true; o.fixPref = 'alt';
      }),
      history: 'A 9-year-old with one eye that has drifted outward for years, more when tired. No double vision.',
      summary: 'A constant divergent squint with a stable angle in all positions of gaze. Fixation alternates.',
      signs: [
        'The corneal reflex of the deviating eye sits nasal to the pupil centre',
        'Cover the fixing eye and the other eye moves inward to take up fixation',
        'Either eye can hold fixation after the cover is removed',
        'The angle does not change across the nine positions; adduction is full',
        'No diplopia: suppression'
      ],
      localise: 'Usually a decompensated intermittent exotropia, or a sensory or consecutive exotropia. No paretic muscle.',
      pitfall: 'A third nerve palsy and an INO also leave an eye out. Look for limited adduction, ptosis or a vertical element, none of which belong to a comitant exotropia.'
    },
    {
      id: 'ci', name: 'Convergence insufficiency', short: 'Exophoria at near, remote near point', group: 'baseline',
      sided: false, site: 'vergence',
      build: build(function (o) {
        o.verg = { gain: 0.55, max: 15 }; o.fusion = { h: 9, v: 2 }; o.fixPref = 'alt';
      }),
      history: 'A 22-year-old student with eye strain, headache and words that “split in two” after twenty minutes of reading.',
      summary: 'Straight at distance, but with an exophoria at near and a near point of convergence that has receded.',
      signs: [
        'No movement on cover testing at 6 m',
        'At 33 cm the covered eye drifts out and recovers slowly when uncovered: exophoria',
        'Bring the target closer: one eye gives up and swings out at 20–25 cm',
        'Adduction is full on lateral gaze, so the medial recti themselves are normal',
        'Crossed diplopia at near only'
      ],
      localise: 'A disorder of vergence control, not of muscle or nerve. Common in young adults and after concussion; also seen in Parkinson disease.',
      pitfall: 'Bilateral INO also loses adduction, but there it fails on lateral gaze. Here the medial recti work normally on versions.'
    },

    {
      id: 'cn6', name: 'Abducens (CN VI) palsy', short: 'Weak lateral rectus', group: 'nerve',
      sided: true, site: 'cn6',
      build: build(function (o, S, O, sg) {
        o[S] = { s: { LR: 0.2 }, vmax: { ab: 110 } };
        o.fixPref = O; o.fusion = { h: 3.5, v: 1.5 }; o.posture = { yaw: sg * 22 };
      }),
      history: 'A 67-year-old with diabetes and sudden horizontal double vision, worse when driving and when looking to one side.',
      summary: 'A weak lateral rectus gives an incomitant esotropia that is greatest on gaze toward the affected side and at distance.',
      signs: [
        'Esotropia in primary position, hidden by a face turn to the {S}',
        'The {S} eye does not abduct: the limbus stops well short of the outer canthus',
        'The esotropia increases in {S} gaze and disappears in {O} gaze',
        'Secondary deviation: cover the {O} eye and the angle becomes larger',
        'Uncrossed horizontal diplopia, worse at distance than near',
        'The abducting saccade of the {S} eye is slow'
      ],
      localise: 'Microvascular ischaemia is the commonest cause in older adults. Also raised intracranial pressure (a false localising sign), trauma, tumours of the clivus or cavernous sinus, and demyelination.',
      pitfall: 'Duane syndrome also limits abduction, but the globe retracts on adduction and the primary deviation is small. Thyroid eye disease with a tight medial rectus and myasthenia can both imitate it.'
    },
    {
      id: 'cn6bi', name: 'Bilateral abducens (CN VI) palsy', short: 'Both lateral recti weak', group: 'nerve',
      sided: false, site: 'cn6',
      build: build(function (o) {
        o.R = { s: { LR: 0.45 }, vmax: { ab: 150 } };
        o.L = { s: { LR: 0.55 }, vmax: { ab: 170 } };
        o.fixPref = 'alt'; o.fusion = { h: 3, v: 1.5 };
      }),
      history: 'A 28-year-old with two weeks of headache that is worse lying down, brief greying of vision on standing, and horizontal double vision.',
      summary: 'Both lateral recti are weak: an esotropia in primary position that increases on gaze to either side.',
      signs: [
        'Esotropia in primary position, larger at distance than at near',
        'Abduction is limited in both eyes',
        'The esotropia increases on right gaze and on left gaze',
        'Uncrossed diplopia in every horizontal direction',
        'Vertical movements are normal'
      ],
      localise: 'Think of raised intracranial pressure and look for papilloedema. Also clivus tumour, trauma, meningitis and Wernicke encephalopathy. Möbius syndrome when congenital.',
      pitfall: 'Thyroid eye disease with two tight medial recti looks similar. Saccade speed separates them: slow in paresis, normal up to an abrupt stop in restriction.'
    },
    {
      id: 'cn4', name: 'Trochlear (CN IV) palsy', short: 'Weak superior oblique', group: 'nerve',
      sided: true, site: 'cn4',
      build: build(function (o, S, O, sg) {
        o[S] = { s: { SO: 0.25, IO: 1.25 } };
        o.fixPref = O; o.fusion = { h: 3, v: 1.5 };
        o.posture = { roll: -sg * 20, yaw: -sg * 8, pitch: -5 };
      }),
      history: 'A 41-year-old with vertical double vision since a bicycle accident. It is worst going down stairs and when reading.',
      summary: 'A weak superior oblique gives a hypertropia that follows the three-step rule: worse on gaze to the opposite side and on head tilt to the same side.',
      signs: [
        '{Sc} hypertropia in primary position',
        'It increases in {O} gaze, when the {S} eye is adducted, and most of all down and to the {O}',
        'Bielschowsky test: larger on head tilt to the {S}, almost gone on tilt to the {O}',
        'Habitual head tilt to the {O}, with the chin slightly down',
        'The {S} inferior oblique overacts: the eye shoots up in adduction',
        'Vertical diplopia with a tilted second image (excyclotorsion)'
      ],
      localise: 'Congenital (large vertical fusion range, a tilt in old photographs) or acquired from closed head injury or microvascular disease. The nerve exits dorsally and crosses, so a nuclear lesion gives a contralateral palsy.',
      pitfall: 'Skew deviation can pass the three-step test. In skew the higher eye is incyclotorted and the hypertropia often halves when the patient lies supine.'
    },
    {
      id: 'cn4bi', name: 'Bilateral trochlear (CN IV) palsy', short: 'Both superior obliques weak', group: 'nerve',
      sided: false, site: 'cn4',
      build: build(function (o) {
        o.R = { s: { SO: 0.3, IO: 1.15 } };
        o.L = { s: { SO: 0.4, IO: 1.15 } };
        o.fixPref = 'R'; o.fusion = { h: 2, v: 1 }; o.posture = { pitch: -15 };
      }),
      history: 'A 33-year-old after a motorcycle crash with loss of consciousness. Double, tilted images when reading; comfortable when looking up.',
      summary: 'Both superior obliques are weak. The hypertropia reverses with gaze and with tilt, there is a V-pattern esotropia, and the excyclotorsion is large.',
      signs: [
        'Little vertical deviation in primary position',
        'Right hypertropia in left gaze, left hypertropia in right gaze',
        'Right hypertropia on right tilt, left hypertropia on left tilt',
        'V pattern: an esotropia appears in downgaze',
        'Excyclotorsion of 10° or more in downgaze: both images tilt',
        'Chin-down head posture'
      ],
      localise: 'Typically a severe closed head injury, because the two nerves cross in the anterior medullary velum. Also dorsal midbrain lesions.',
      pitfall: 'When asymmetric it passes for a unilateral palsy. Always test both tilts and both side gazes.'
    },
    {
      id: 'cn3p', name: 'Oculomotor (CN III) palsy, pupil involved', short: 'Down and out, ptosis, dilated pupil', group: 'nerve',
      sided: true, site: 'cn3',
      build: build(function (o, S, O) {
        o[S] = {
          s: { MR: 0.05, SR: 0.05, IR: 0.05, IO: 0.05 }, lid: { ptosis: 0.95 },
          pupil: 7.4, pupilFixed: true, vmax: { ad: 90, up: 90, down: 90 }
        };
        o.fixPref = O; o.fusion = { h: 1, v: 0.5 };
      }),
      history: 'A 52-year-old with a sudden severe headache behind one eye, followed within hours by a drooping lid.',
      summary: 'A complete third nerve palsy with a dilated pupil. Treat it as compressive until proven otherwise.',
      signs: [
        'Complete ptosis of the {S} lid. Lift the lids to examine the eye',
        'The {S} eye rests down and out',
        'No adduction, elevation or depression. Abduction is intact (CN VI)',
        'Dilated {S} pupil',
        'The eye still depresses a little and intorts on downgaze: CN IV is working',
        'With the lid lifted: crossed diplopia with a vertical element'
      ],
      localise: 'A posterior communicating artery aneurysm must be excluded urgently with CT or MR angiography. Also uncal herniation, tumour and trauma. The pupil fibres run on the surface of the nerve, so compression reaches them early.',
      pitfall: 'A normal pupil is reassuring only when the external palsy is complete. A partial palsy with a normal pupil can still be an aneurysm.'
    },
    {
      id: 'cn3s', name: 'Oculomotor (CN III) palsy, pupil spared', short: 'Down and out, ptosis, normal pupil', group: 'nerve',
      sided: true, site: 'cn3',
      build: build(function (o, S, O) {
        o[S] = {
          s: { MR: 0.05, SR: 0.05, IR: 0.05, IO: 0.05 }, lid: { ptosis: 0.92 },
          vmax: { ad: 90, up: 90, down: 90 }
        };
        o.fixPref = O; o.fusion = { h: 1, v: 0.5 };
      }),
      history: 'A 71-year-old with diabetes and hypertension. Aching around one eye for two days, then the lid dropped.',
      summary: 'A complete external third nerve palsy with a normal pupil: the microvascular pattern.',
      signs: [
        'Marked ptosis of the {S} lid. Lift the lids to examine the eye',
        'The {S} eye rests down and out, with no adduction, elevation or depression',
        'The pupils are equal',
        'Abduction is full, and the eye intorts on attempted downgaze',
        'With the lid lifted: crossed diplopia with a vertical element'
      ],
      localise: 'Ischaemia of the core of the nerve in diabetes or hypertension spares the superficial pupil fibres. Often painful at onset; recovers within about three months.',
      pitfall: 'An incomplete palsy, or a pupil that is only relatively spared, still needs angiography. Consider giant cell arteritis in the elderly. Myasthenia can imitate any pupil-sparing pattern.'
    },

    {
      id: 'ino', name: 'Internuclear ophthalmoplegia', short: 'Adduction fails on gaze, not on convergence', group: 'brainstem',
      sided: true, site: 'mlf',
      sideNote: 'the side of the eye that fails to adduct',
      build: build(function (o, S, O, sg) {
        o[S] = { ino: 0.3, vmax: { ad: 70 } };
        o.fixPref = O; o.fusion = { h: 3, v: 1.5 };
        o.nystagmus = [abductingNystagmus(O, -sg)];
      }),
      history: 'A 29-year-old with a week of blurred and double vision on looking to one side. Last year her legs were numb for a month.',
      summary: 'A lesion of the medial longitudinal fasciculus. The eye on the side of the lesion adducts poorly on lateral gaze, yet converges normally.',
      signs: [
        'The {S} eye adducts slowly and incompletely on {O} gaze',
        'The {O} eye shows abducting nystagmus on {O} gaze',
        'Convergence is intact: both eyes adduct to a near target',
        'Straight in primary position',
        'Best seen with saccades. Tap to the {O} and watch the {S} eye lag',
        'Crossed diplopia on gaze away from the lesion'
      ],
      localise: 'The MLF on the side of the adduction deficit, between the abducens nucleus in the pons and the oculomotor nucleus in the midbrain. Demyelination in the young, often bilateral. Brainstem stroke in older patients.',
      pitfall: 'Myasthenia can produce a pseudo-INO. A medial rectus weakness from a partial third nerve palsy would lose convergence as well.'
    },
    {
      id: 'webino', name: 'Bilateral INO (WEBINO)', short: 'Wall-eyed, neither eye adducts', group: 'brainstem',
      sided: false, site: 'mlf',
      build: build(function (o) {
        o.R = { ino: 0.25, vmax: { ad: 70 } };
        o.L = { ino: 0.25, vmax: { ad: 70 } };
        o.verg = { bias: -6, gain: 0.3, max: 6 }; o.fusion = { h: 0, v: 0 }; o.fixPref = 'alt';
        o.nystagmus = [abductingNystagmus('R', 1), abductingNystagmus('L', -1)];
      }),
      history: 'A 34-year-old with known multiple sclerosis and new double vision in every direction except straight up and down.',
      summary: 'Both medial longitudinal fasciculi are affected. Neither eye adducts on lateral gaze and the eyes rest in exotropia: wall-eyed bilateral INO.',
      signs: [
        'Exotropia in primary position',
        'The right eye fails to adduct on left gaze, the left eye on right gaze',
        'Abducting nystagmus in each eye in turn',
        'Convergence is lost',
        'Vertical gaze is full'
      ],
      localise: 'Bilateral MLF lesions, usually near the midbrain. Multiple sclerosis and brainstem stroke.',
      pitfall: 'A comitant exotropia has full adduction on versions. Bilateral medial rectus weakness from myasthenia can look identical.'
    },
    {
      id: 'oneandahalf', name: 'One-and-a-half syndrome', short: 'Only one eye abducts', group: 'brainstem',
      sided: true, site: 'ponsmlf',
      sideNote: 'the side of the gaze palsy, which is the side of the lesion',
      build: build(function (o, S, O, sg) {
        o.nuclear = sg > 0 ? { right: 0.03, bias: -8 } : { left: 0.03, bias: 8 };
        o[S] = { ino: 0.05 };
        o.fixPref = S; o.fusion = { h: 2, v: 1.5 };
        o.nystagmus = [abductingNystagmus(O, -sg)];
      }),
      history: 'A 63-year-old with sudden double vision and unsteadiness. He says only one eye “still moves sideways”.',
      summary: 'A pontine lesion takes out the horizontal gaze centre and the MLF on the same side. The only horizontal movement left is abduction of the opposite eye.',
      signs: [
        'Neither eye moves to the {S}: the “one”',
        'The {S} eye does not adduct on {O} gaze: the “half”',
        'The {O} eye abducts, with nystagmus',
        'The {O} eye sits outward in primary position (paralytic pontine exotropia)',
        'Vertical gaze and convergence are spared',
        'The doll’s head manoeuvre does not bring the eyes to the {S}'
      ],
      localise: 'The dorsal pontine tegmentum on the side of the gaze palsy: PPRF or abducens nucleus, plus the MLF beside it. Stroke, demyelination, tumour.',
      pitfall: 'With a facial palsy it becomes “eight-and-a-half”. Myasthenia and Miller Fisher syndrome can imitate it.'
    },
    {
      id: 'gaze', name: 'Horizontal gaze palsy', short: 'Neither eye looks to one side', group: 'brainstem',
      sided: true, site: 'pons',
      sideNote: 'the side the eyes cannot look toward',
      build: build(function (o, S, O, sg) {
        o.nuclear = sg > 0 ? { right: 0.04, bias: -3 } : { left: 0.04, bias: 3 };
        o.fixPref = 'alt'; o.fusion = { h: 5, v: 2 }; o.posture = { yaw: sg * 16 };
      }),
      history: 'A 58-year-old after a pontine haemorrhage. He turns his head rather than his eyes to look to one side. No double vision.',
      summary: 'Neither eye moves to one side. Both are affected equally, so they stay aligned and there is no diplopia.',
      signs: [
        'No saccade or pursuit to the {S} in either eye',
        'The eyes stay aligned in every position: no movement on cover test',
        'Vertical gaze and convergence are normal',
        'The doll’s head manoeuvre does not overcome it, so the lesion is nuclear',
        'Face turned to the {S}'
      ],
      localise: 'The abducens nucleus or PPRF on the side of the palsy. The nucleus holds both the abducens motor neurons and the interneurons for the opposite medial rectus, so a nuclear lesion gives a gaze palsy and not an isolated abduction deficit.',
      pitfall: 'A sixth nerve palsy affects one eye and causes esotropia and diplopia. A frontal lesion gives a gaze preference that the doll’s head manoeuvre overcomes.'
    },
    {
      id: 'parinaud', name: 'Dorsal midbrain (Parinaud) syndrome', short: 'Upgaze palsy with retraction nystagmus', group: 'brainstem',
      sided: false, site: 'pretectum',
      build: build(function (o) {
        o.supra = { up: 0.08 };
        o.R = { lid: { retraction: 1.9 }, pupil: 5.6 };
        o.L = { lid: { retraction: 1.9 }, pupil: 5.6 };
        o.verg = { max: 24 }; o.fusion = { h: 5, v: 2 };
        o.nystagmus = [{ type: 'convret', amp: 3.2, freq: 2.1, when: function (sol) { return (sol.ver.y - 6) / 10; } }];
      }),
      history: 'A 19-year-old with a month of headaches and difficulty looking up.',
      summary: 'A supranuclear upgaze palsy with convergence-retraction nystagmus, lid retraction and large pupils that react better to near than to light.',
      signs: [
        'Upward saccades and pursuit are lost; downgaze is preserved',
        'On attempted upgaze the eyes jerk inward and retract',
        'Lid retraction on both sides (Collier sign)',
        'Mid-dilated pupils',
        'Doll’s head: tip the chin down and the eyes do elevate. The lesion is supranuclear',
        'Horizontal alignment is normal'
      ],
      localise: 'Pretectum and posterior commissure. Pineal tumours and hydrocephalus in the young, midbrain stroke or haemorrhage in older adults, and shunt failure.',
      pitfall: 'Bilateral limitation of elevation in thyroid eye disease or myasthenia does not improve with the doll’s head manoeuvre and has no retraction nystagmus.'
    },
    {
      id: 'psp', name: 'Progressive supranuclear palsy', short: 'Slow vertical saccades, downgaze worst', group: 'brainstem',
      sided: false, site: 'rimlf',
      build: build(function (o) {
        o.supra = { up: 0.35, down: 0.1, right: 0.85, left: 0.85 };
        var eye = { lid: { retraction: 1.3 }, vmax: { ab: 190, ad: 190, up: 45, down: 45 } };
        o.R = eye; o.L = JSON.parse(JSON.stringify(eye));
        o.verg = { gain: 0.7, max: 12 }; o.fusion = { h: 6, v: 2 }; o.blinkEvery = 13;
        o.nystagmus = [{ type: 'swj', amp: 1.6, freq: 0.7, when: function (sol) { return Math.abs(sol.ox) + Math.abs(sol.oy) < 8 ? 1 : 0; } }];
      }),
      history: 'A 68-year-old with repeated backward falls, trouble reading, and difficulty seeing the food on his plate.',
      summary: 'A supranuclear vertical gaze palsy. Vertical saccades are slow and small, downgaze first, and the vestibulo-ocular reflex overcomes the limitation.',
      signs: [
        'Downward saccades are slow and very limited; upgaze is reduced too',
        'Horizontal saccades are slowed',
        'Doll’s head: moving the head gives a full vertical range',
        'Square-wave jerks in primary position',
        'A staring look: lid retraction and infrequent blinking',
        'Convergence is poor'
      ],
      localise: 'A tauopathy of the rostral midbrain (riMLF) and basal ganglia. Falls, axial rigidity and dysarthria complete the picture.',
      pitfall: 'Limited upgaze alone is common in healthy older people. Downgaze palsy and slow saccades are what count. Parinaud syndrome spares downgaze.'
    },
    {
      id: 'skew', name: 'Skew deviation', short: 'Comitant hypertropia with ocular tilt', group: 'brainstem',
      sided: true, site: 'otolith',
      sideNote: 'the higher eye',
      build: build(function (o, S, O, sg) {
        o[S] = { vOffset: 3, tOffset: -5 };
        o[O] = { vOffset: -3, tOffset: 7 };
        o.fixPref = O; o.fusion = { h: 3, v: 1.2 }; o.posture = { roll: -sg * 12 };
      }),
      history: 'A 60-year-old with acute vertigo, vomiting, an unsteady gait and vertical double vision.',
      summary: 'A vertical misalignment from a lesion of the otolith–ocular pathway. It is roughly comitant and comes with torsion and a head tilt: the ocular tilt reaction.',
      signs: [
        '{Sc} hypertropia that is much the same in right and left gaze',
        'It hardly changes with head tilt to either side',
        'Head tilted toward the lower ({O}) eye',
        'The higher eye is incyclotorted, the opposite of a fourth nerve palsy',
        'Ductions are full'
      ],
      localise: 'Brainstem or cerebellum, less often the labyrinth. The utricular pathway crosses in the pons: a lesion below it lowers the eye on that side, a lesion above it (midbrain, MLF) raises it. It often accompanies an INO.',
      pitfall: 'A fourth nerve palsy has excyclotorsion of the higher eye and a positive tilt test. The upright–supine test helps: a skew halves when the patient lies down.'
    },

    {
      id: 'mg', name: 'Ocular myasthenia gravis', short: 'Fatigable ptosis and variable weakness', group: 'muscle',
      sided: false, site: 'nmj',
      build: build(function (o) {
        o.R = { s: { MR: 0.72, SR: 0.75 }, fatigable: { SR: 0.4, MR: 0.3, IO: 0.2 }, lid: { ptosis: 0.3, fatigue: 0.5 } };
        o.L = { s: { LR: 0.86, IR: 0.88 }, fatigable: { LR: 0.15 }, lid: { ptosis: 0.1, fatigue: 0.3 } };
        o.fixPref = 'L'; o.fusion = { h: 2.5, v: 1.2 };
        o.fatigue = { rise: 7, recover: 9 }; o.cogan = true;
      }),
      history: 'A 36-year-old whose lid droops and vision doubles in the evening. She is fine in the morning.',
      summary: 'Fatigable, variable weakness of the lids and extraocular muscles that follows no single nerve. The pupils are always normal.',
      signs: [
        'Asymmetric ptosis that deepens on sustained upgaze. Hold the target up for ten seconds',
        'Cogan lid twitch: the lid overshoots when the eyes return from downgaze',
        'Weakness that fits no nerve: here adduction and elevation of the right eye',
        'The deviation grows as the muscles tire and recovers with rest',
        'Pupils are normal'
      ],
      localise: 'Antibodies against the acetylcholine receptor at the neuromuscular junction. Ice test, rest test, antibodies and single-fibre EMG. Image the thymus.',
      pitfall: 'It can imitate an INO, a pupil-sparing third, a sixth or a gaze palsy. Variability and fatigue are the clue.'
    },
    {
      id: 'cpeo', name: 'Chronic progressive external ophthalmoplegia', short: 'Symmetric ptosis, eyes barely move', group: 'muscle',
      sided: false, site: 'myopathy',
      build: build(function (o) {
        var eye = {
          s: { LR: 0.4, MR: 0.4, SR: 0.4, IR: 0.4, SO: 0.4, IO: 0.4 }, lid: { ptosis: 0.52 }, browLift: 2.4,
          vmax: { ab: 110, ad: 110, up: 110, down: 110 }
        };
        o.R = eye; o.L = JSON.parse(JSON.stringify(eye));
        o.fusion = { h: 6, v: 2 }; o.posture = { pitch: 10 }; o.blinkEvery = 5;
      }),
      history: 'A 44-year-old whose lids have drooped slowly over ten years. She turns her head to look around. No double vision.',
      summary: 'A slowly progressive, symmetric loss of eye movement in all directions with bilateral ptosis. There is usually no diplopia.',
      signs: [
        'Symmetric ptosis on both sides, raised brows and a chin-up posture',
        'Gaze is limited in every direction, equally in both eyes',
        'Saccades are slow',
        'The eyes stay aligned, so there is little or no diplopia',
        'The doll’s head manoeuvre does not help, and nothing fatigues or varies',
        'Pupils are normal'
      ],
      localise: 'A mitochondrial myopathy of the extraocular muscles. Kearns–Sayre syndrome adds pigmentary retinopathy and heart block, so request an ECG.',
      pitfall: 'Myasthenia varies and fatigues. Oculopharyngeal dystrophy adds dysphagia. PSP improves with the doll’s head manoeuvre.'
    },

    {
      id: 'ted', name: 'Thyroid eye disease', short: 'Lid retraction, tight inferior rectus', group: 'mechanical',
      sided: true, site: 'tedmuscle',
      sideNote: 'the eye with the greater restriction', sideAlso: 'B',
      build: build(function (o, S, O) {
        o[S] = { limits: { up: [-2, -10], ab: 28, soft: 0.25 }, lid: { retraction: 2.3, lower: 0.8, lag: 0.6 }, globe: 'proptosis' };
        o[O] = { limits: { up: [24, 18], soft: 0.3 }, lid: { retraction: 1.7, lower: 0.5, lag: 0.6 }, globe: 'proptosis' };
        o.fixPref = O; o.fusion = { h: 2.5, v: 1 }; o.posture = { pitch: 10 }; o.blinkEvery = 7;
      }),
      history: 'A 48-year-old smoker with gritty, staring eyes and vertical double vision on waking and on looking up.',
      summary: 'A restrictive myopathy. Tight inferior and medial recti limit elevation and abduction, and lid retraction with proptosis gives the diagnosis away.',
      signs: [
        'Lid retraction on both sides, with lid lag on downgaze',
        'Proptosis',
        '{Sc} hypotropia that increases in upgaze. Elevation is limited, most in abduction',
        'Abduction of the {S} eye is mildly limited by a tight medial rectus',
        'Chin-up head posture',
        'Saccades run at normal speed and stop abruptly: restriction, not paresis'
      ],
      localise: 'Autoimmune inflammation and later fibrosis of the muscle bellies, in the order inferior, medial, superior, lateral rectus. Forced duction is positive and the intraocular pressure rises on upgaze. Watch for compressive optic neuropathy.',
      pitfall: 'Limited elevation looks like a superior rectus palsy, but the fault lies in the tight antagonist. Myasthenia coexists in a few percent: suspect it when ptosis or an exotropia appears.'
    },
    {
      id: 'blowout', name: 'Orbital floor fracture', short: 'Tethered inferior rectus after trauma', group: 'mechanical',
      sided: true, site: 'floor',
      build: build(function (o, S, O) {
        o[S] = { limits: { up: 8, down: 16, soft: 0.12 }, globe: 'enophthalmos', bruise: true };
        o.fixPref = O; o.fusion = { h: 3, v: 1.5 };
      }),
      history: 'A 24-year-old punched in the eye yesterday. Double vision looking up and down, with a numb cheek and upper teeth.',
      summary: 'The inferior rectus or the tissue around it is caught in a fracture of the orbital floor. Elevation is tethered and depression is weak.',
      signs: [
        'Straight in primary position',
        'The {S} eye has limited elevation and limited depression',
        'Vertical diplopia in upgaze and again in downgaze',
        'Enophthalmos and bruising around the {S} eye',
        'Numbness of the cheek in the territory of the infraorbital nerve'
      ],
      localise: 'Blunt trauma from an object larger than the orbital rim. In children a trapdoor fracture, with a quiet white eye and nausea or bradycardia on upgaze, needs urgent release.',
      pitfall: 'Early limitation can be oedema or haematoma and may settle. A forced duction test and CT separate entrapment from muscle contusion or nerve injury.'
    },
    {
      id: 'brown', name: 'Brown syndrome', short: 'No elevation in adduction', group: 'mechanical',
      sided: true, site: 'trochlea',
      build: build(function (o, S, O, sg) {
        o[S] = { limits: { up: [-4, 32], soft: 0.1 } };
        o.fixPref = O; o.fusion = { h: 4, v: 2 }; o.posture = { pitch: 8, yaw: -sg * 8 };
      }),
      history: 'A 6-year-old whose parents notice that one eye “stays behind” when she looks up toward her nose. She has no complaints.',
      summary: 'The superior oblique tendon cannot slide through the trochlea, so the eye cannot elevate when it is adducted.',
      signs: [
        'The {S} eye does not elevate in adduction',
        'Elevation improves in the midline and is near normal in abduction',
        'Straight in primary position, with a small downshoot in adduction',
        'The superior oblique does not overact',
        'Chin up, with the face turned slightly to the {O}'
      ],
      localise: 'A congenitally short or tight tendon sheath, or acquired from inflammation of the trochlea (rheumatoid arthritis, sinusitis), trauma or surgery. Forced duction is positive when the adducted eye is elevated.',
      pitfall: 'An inferior oblique palsy also limits elevation in adduction, but it has superior oblique overaction, an A pattern and a positive head tilt test.'
    },
    {
      id: 'duane', name: 'Duane retraction syndrome, type 1', short: 'No abduction, globe retracts on adduction', group: 'mechanical',
      sided: true, site: 'dysinnervation',
      build: build(function (o, S, O, sg) {
        o[S] = { limits: { ab: -4, ad: 38, soft: 0.08 }, shoot: 0.45, retract: 0.9, vmax: { ab: 160 } };
        o.fixPref = O; o.fusion = { h: 3, v: 2 }; o.suppression = true; o.posture = { yaw: sg * 12 };
      }),
      history: 'A 7-year-old referred from school screening because one eye does not move outward. She has always held her face slightly turned.',
      summary: 'A congenital miswiring: the lateral rectus is innervated by the oculomotor nerve. Abduction is limited and the globe retracts on adduction.',
      signs: [
        'The {S} eye barely abducts',
        'On adduction the {S} globe retracts and the palpebral fissure narrows',
        'Upshoot or downshoot of the {S} eye in adduction',
        'Only a small esotropia in primary position, far less than the abduction deficit suggests',
        'Face turned to the {S}, and no complaint of diplopia'
      ],
      localise: 'The abducens nucleus and nerve are absent and a branch of CN III supplies the lateral rectus: a congenital cranial dysinnervation disorder. More often the left eye and more often girls. Check hearing and the cervical spine.',
      pitfall: 'A sixth nerve palsy has a large esotropia in primary position and no retraction.'
    },
    {
      id: 'med', name: 'Monocular elevation deficiency', short: 'One eye cannot look up in any gaze', group: 'mechanical',
      sided: true, site: 'elevators',
      build: build(function (o, S, O) {
        o[S] = { s: { SR: 0.3, IO: 0.35 }, limits: { up: 12, soft: 0.2 }, lid: { ptosis: 0.22 } };
        o.fixPref = O; o.fusion = { h: 3, v: 1 }; o.suppression = true; o.posture = { pitch: 12 };
      }),
      history: 'A 5-year-old with one eye lower than the other and a drooping lid since birth. She lifts her chin to look at people.',
      summary: 'One eye cannot elevate in any position of gaze: in abduction, in the midline or in adduction. Formerly called double elevator palsy.',
      signs: [
        '{Sc} hypotropia in primary position that increases in upgaze',
        'Elevation is limited equally in abduction and in adduction',
        'Ptosis or pseudoptosis on the {S}: the lid follows the low eye',
        'Chin-up head posture',
        'Horizontal movements and depression are normal'
      ],
      localise: 'One of three mechanisms: a tight inferior rectus, a weak superior rectus, or a supranuclear deficit with Bell phenomenon preserved. Usually congenital.',
      pitfall: 'Brown syndrome spares elevation in abduction. Orbital floor fracture and thyroid eye disease also limit elevation, so look for their other signs. Pseudoptosis disappears when the low eye takes up fixation.'
    }
  ];

  var BY_ID = {};
  LIST.forEach(function (c) { BY_ID[c.id] = c; });

  function fill(text, side) {
    var S = side === 'L' ? 'left' : 'right', O = side === 'L' ? 'right' : 'left';
    function capWord(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
    return text.replace(/\{Sc\}/g, capWord(S)).replace(/\{Oc\}/g, capWord(O)).replace(/\{S\}/g, S).replace(/\{O\}/g, O);
  }

  CG.conditions = { list: LIST, byId: BY_ID, groups: GROUPS, sites: SITES, fill: fill };
})(typeof globalThis !== 'undefined' ? globalThis : this);
