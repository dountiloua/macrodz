# Macro DZ: Project Plan

A localized fitness and calorie-tracking mobile app for Algeria. Runs on iOS and Android from one codebase.

## 1. Rules for the AI agent (read first, always follow)

1. Work on **one phase at a time**. Never start the next phase until asked.
2. After each phase: list the files changed, tell me how to test it on my phone, then stop.
3. Use **TypeScript strict mode**. No `any` unless justified in a comment.
4. Keep business logic (calculations, unit conversion, API parsing) in `src/features/*/` as **pure functions**, separate from UI, so they are easy to test.
5. Write **unit tests (Jest)** for every calculation and conversion function.
6. **Never hardcode secrets.** Use `.env` and `EXPO_PUBLIC_` variables only for public keys. `.env` must be in `.gitignore`.
7. Make **small commits** with clear messages, one per feature.
8. If a requirement is unclear, ask me before guessing.
9. UI must support **French and English** from the start (use `i18next`); Arabic can come later.

## 2. Stack

| Layer | Choice |
|---|---|
| App | Expo (React Native) + TypeScript, Expo Router |
| Backend | Supabase (Postgres, Auth, Row Level Security) |
| Local storage | `expo-sqlite` for offline cache |
| Barcode | `expo-camera` |
| State | Zustand |
| Server data | TanStack Query |
| Charts | `react-native-gifted-charts` or Victory Native |
| Tests | Jest |

## 3. Folder structure

```
macro-dz/
├── app/                     # Expo Router screens
│   ├── (tabs)/
│   │   ├── diary.tsx
│   │   ├── workouts.tsx
│   │   ├── progress.tsx
│   │   └── profile.tsx
│   ├── onboarding/
│   └── scan.tsx
├── src/
│   ├── features/
│   │   ├── nutrition-calc/  # BMR, TDEE, macro targets (pure functions)
│   │   ├── food-lookup/     # Open Food Facts client, cache, fallback
│   │   ├── serving-units/   # unit conversion (pure functions)
│   │   ├── diary/
│   │   ├── workouts/
│   │   ├── body-metrics/
│   │   └── close-macros/    # product recommendation engine
│   ├── components/          # shared UI
│   ├── lib/                 # supabase client, i18n, constants
│   ├── store/               # Zustand stores
│   └── types/
├── supabase/
│   └── migrations/          # SQL files
├── PLAN.md
└── .env.example
```

## 4. Core logic (specification)

### 4.1 Calorie and macro calculator

**BMR**
- Mifflin-St Jeor: `10*kg + 6.25*cm - 5*age + 5` (male), `... - 161` (female)
- Katch-McArdle (when body fat % is given): `370 + 21.6 * leanMassKg`, where `leanMassKg = kg * (1 - bodyFat/100)`

**TDEE** = BMR x activity multiplier, from training days per week:

| Days/week | Multiplier |
|---|---|
| 0-1 | 1.2 |
| 2-3 | 1.375 |
| 4-5 | 1.55 |
| 6-7 | 1.725 |

**Goal adjustment**: Cut = -20% of TDEE, Maintain = 0, Lean Bulk = +10%.

**Macros**
- Protein: 2.0 g/kg bodyweight (2.2 g/kg on Cut)
- Fat: 0.8 g/kg, minimum 20% of calories
- Carbs: remaining calories / 4
- Energy: 4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat

All constants live in one config file so they can be tuned later.

### 4.2 Serving unit conversion

Base unit is **per 100 g** (or per 100 ml for liquids). Supported units:

| Unit | Conversion |
|---|---|
| g | direct |
| ml | ml x density (default 1.0; milk 1.03; oil 0.92) |
| unit / pot | uses `serving_quantity` from the API product |
| tbsp | 15 ml |
| tsp | 5 ml |
| glass | 240 ml (configurable constant) |
| cup | 240 ml |

Example: "2 glasses of milk" = 480 ml x 1.03 = 494.4 g, then multiply the per-100g nutriments by 4.944.

Every conversion returns `{ grams, kcal, protein, carbs, fat }`. If a unit is not possible for a product (for example "pot" with no serving size), return a clear error the UI can show.

### 4.3 Open Food Facts lookup

- Endpoint: `https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=code,product_name,brands,serving_size,serving_quantity,quantity,nutriments`
- Send a custom `User-Agent` header, for example `MacroDZ/1.0 (contact-email)`.
- Use per-100g values: `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`. If kcal is missing but `energy_100g` (kJ) exists, divide by 4.184.
- Lookup order: **local SQLite cache -> Supabase `products` table -> Open Food Facts -> "not found, add it yourself" flow**.
- Cache every successful result in Supabase so the next user never hits Open Food Facts for it.
- Respect rate limits: debounce, retry with backoff on 429/5xx, never fire lookups in a loop.
- Validate data: reject products where macros are missing or clearly impossible (for example protein + carbs + fat > 100 g per 100 g).

### 4.4 Missing product flow

If a barcode is not found, the user can add it: product name, brand, and per-100g (or per serving) kcal, protein, carbs, fat, optionally a photo of the label. Save to `products` with `source = 'user'` and `verified = false`.

## 5. Database sketch (Supabase / Postgres)

- `profiles`: user id, gender, birth year, height_cm, goal, training_days, body_fat_pct, calorie and macro targets
- `products`: barcode (unique), name, brand, per-100g kcal/protein/carbs/fat, serving_size_g, serving_label, density, source (`off` / `user`), verified
- `food_logs`: user id, product id, date, meal, quantity, unit, grams, computed kcal/protein/carbs/fat
- `workouts`: user id, date, name
- `workout_sets`: workout id, exercise, set number, reps, weight_kg (volume = reps x weight_kg, computed)
- `body_metrics`: user id, date, weight_kg, optional measurements (chest, waist, arms, thighs)

Enable **Row Level Security** on every user table so users can only read and write their own rows. `products` is readable by everyone, writable by authenticated users.

## 6. Phases

### Phase 0: Setup
- Create Expo + TypeScript project with Expo Router and the folder structure above.
- Install dependencies, set up Jest, ESLint, Prettier.
- Add `.env.example`, `.gitignore`, Supabase client in `src/lib/`.
- Four empty tab screens that render.
- **Done when:** `npx expo start` runs and I can open the app in Expo Go and switch between tabs.

### Phase 1: Calculator and onboarding
- Implement section 4.1 as pure functions with Jest tests.
- Onboarding screens: gender, age, height, weight, optional body fat, training days, goal.
- Show resulting calories and macro targets and save them locally.
- **Done when:** tests pass and I can complete onboarding and see my targets.

### Phase 2: Serving units
- Implement section 4.2 as pure functions with Jest tests (including the "2 glasses of milk" example).

### Phase 3: Barcode scan and lookup
- Scan screen with `expo-camera`.
- Implement section 4.3 and 4.4, with local cache.
- Show product macros and let me pick quantity and unit.

### Phase 4: Food diary
- Supabase tables and RLS, auth (email), daily diary with meals, daily totals versus targets with progress bars.

### Phase 5: Workout logger
- Create workout, add exercises, sets, reps, weight; show volume per exercise and per session; history.

### Phase 6: Body metrics
- Log weight and measurements, weight chart, weekly average.

### Phase 7: Close Your Macros
- Given remaining macros for the day, suggest local products from the `products` table that best fit (prioritize protein), with suggested quantities.

### Phase 8: Polish and release
- French/English texts, empty and error states, app icon and splash screen, EAS Build, store listings, privacy policy.

## 7. Out of scope for now

Payments or subscriptions, social features, AI photo recognition of meals, Arabic/RTL, wearable integrations.
