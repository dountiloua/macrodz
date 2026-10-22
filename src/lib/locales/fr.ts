export const fr = {
  common: {
    appName: 'Macro DZ',
    back: 'Retour',
    next: 'Suivant',
    skip: 'Ignorer',
    save: 'Enregistrer',
    stepOf: 'Étape {{current}} sur {{total}}',
    editAnswers: 'Modifier les réponses',
    units: {
      kcal: 'kcal',
      g: 'g',
      cm: 'cm',
      kg: 'kg',
      percent: '%',
      years: 'ans',
      daysPerWeek: 'jours/semaine',
    },
  },
  tabs: {
    diary: 'Journal',
    workouts: 'Entraînements',
    progress: 'Progression',
    profile: 'Profil',
  },
  screens: {
    placeholderDescription: 'Cet écran arrivera dans une phase ultérieure.',
  },
  onboarding: {
    gender: {
      title: 'Quel est votre genre ?',
      subtitle: 'Utilisé pour choisir votre formule de métabolisme de base.',
      male: 'Homme',
      female: 'Femme',
    },
    age: {
      title: 'Quel âge avez-vous ?',
      placeholder: 'Âge',
    },
    height: {
      title: 'Quelle est votre taille ?',
      placeholder: 'Taille',
      unit: 'cm',
    },
    weight: {
      title: 'Quel est votre poids ?',
      placeholder: 'Poids',
      unit: 'kg',
    },
    bodyFat: {
      title: 'Connaissez-vous votre masse grasse ?',
      subtitle: 'Facultatif. Si vous ignorez, la formule Mifflin-St Jeor est utilisée.',
      placeholder: 'Masse grasse',
      unit: '%',
      skip: 'Je ne sais pas',
    },
    trainingDays: {
      title: 'Combien de jours par semaine vous entraînez-vous ?',
      subtitle: 'Choisissez entre 0 et 7 jours.',
      unit: 'jours/semaine',
    },
    goal: {
      title: 'Quel est votre objectif ?',
      cut: 'Sèche',
      cutHint: 'Perdre du gras',
      maintain: 'Maintien',
      maintainHint: 'Garder votre poids',
      leanBulk: 'Prise de masse sèche',
      leanBulkHint: 'Prendre du muscle lentement',
    },
  },
  results: {
    title: 'Vos objectifs',
    subtitle: 'Calculés à partir de vos réponses.',
    bmr: 'MB',
    tdee: 'DEJ',
    calories: 'Calories cibles',
    protein: 'Protéines',
    carbs: 'Glucides',
    fat: 'Lipides',
    save: 'Enregistrer et commencer',
    warningsTitle: 'Remarques',
  },
  profile: {
    targetsTitle: 'Vos objectifs',
    bmr: 'MB',
    tdee: 'DEJ',
    calories: 'Calories cibles',
    protein: 'Protéines',
    carbs: 'Glucides',
    fat: 'Lipides',
    redo: 'Refaire le questionnaire',
  },
  validation: {
    required: 'Ce champ est obligatoire.',
    invalidNumber: 'Saisissez un nombre valide.',
    ageTooLow: 'Vous devez avoir au moins 18 ans pour utiliser Macro DZ.',
    ageTooHigh: "L'âge doit être inférieur ou égal à 90.",
    heightOutOfRange: 'La taille doit être comprise entre {{min}} et {{max}} cm.',
    weightOutOfRange: 'Le poids doit être compris entre {{min}} et {{max}} kg.',
    bodyFatOutOfRange: 'La masse grasse doit être comprise entre {{min}} et {{max}} %.',
    trainingDaysOutOfRange:
      'Le nombre de jours doit être un nombre entier compris entre {{min}} et {{max}}.',
  },
  warnings: {
    PROTEIN_CAPPED: 'Les protéines ont été plafonnées à 2,2 g par kg de masse maigre ou à 220 g.',
    FAT_REDUCED_TO_FLOOR:
      'Les lipides ont été réduits à 20 % des calories pour laisser de la place aux glucides.',
    PROTEIN_REDUCED:
      'Les protéines ont été réduites à 1,6 g par kg pour respecter votre cible calorique.',
    CALORIES_RAISED:
      'Les calories cibles ont été augmentées pour couvrir le minimum de protéines et de lipides.',
    CALORIES_RAISED_TO_FLOOR:
      'Les calories cibles ont été augmentées au minimum sûr pour votre profil.',
  },
} as const;
