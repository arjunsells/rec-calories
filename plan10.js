'use strict';
// Meal-plan inputs only. No personal measurements or source documents. Metric throughout.
// v10 (pass 2): Arjun's real day. No breakfast, no pre-gym meal: Lunch -> gym 4-6 pm -> Dinner (after the gym, the
// biggest meal) -> an optional high-protein snack that closes the gap to the goals (1,900 kcal / 220 P / 150 C / 45 F).
// Every slot has exactly three options in a fixed order:
//   Strict  plain whole food bought or cooked at home: max 5 ingredients, minimal steps, microwave or batch prep
//   Medium  an easy takeaway or a very easy home cook (supermarket premade, grab-and-go)
//   Free    Uber Eats
// Lunch pins the two one-tap go-tos first, and they keep that order: the Nando's 1/2 PERi-PERi chicken (a plain half
// chicken, no sides: the takeaway twin of "half roast chicken") as Strict, and Gochi + 4 Nando's tenders as Medium.
// Every option: a name, kcal + protein/carbs/fat in grams, and a "how" of at most three steps (takeaway: what to order,
// what to ask for). A typical day (the 1/2 chicken, the Strict dinner, the Strict snack) is 1,908 kcal / 225 P / 140 C /
// 49 F.
// Sources: the 1/2 chicken is nandos.com.au (715 / 108 / 1.1 / 30.8; macromenu lists 690 / 104 / 1.1 / 29.8); Gochi +
// 4 tenders is Arjun's own sum (Gochi chicken cup 225 / 31.8 / 25.2 / 2.6 + 4 PERi tenders 220 / 39.6 / 0.7 / 6.5).
// Kept from v9 (same macros): the GYG bowl, steak & mash + pot, tenders + YoPRO. The 1/2 chicken + pita adds a pita
// (230 / 7.5 / 44 / 2.8, the v9 1/4-chicken-and-pita less an estimated 1/4 chicken) to the official 1/2 chicken.
// Estimates (typical label values, check the pack): roast chicken meat, skin off, 165 kcal / 28 P / 0.5 C / 5.5 F per
// 100 g; microwave baby potatoes 75 / 2 / 15.8 / 0.1 per 100 g; a corn cob 96 / 3.4 / 21 / 1.5; 20 g PERi-PERi sauce
// 15 / 0.2 / 1.2 / 1; YoPRO Vanilla 160 g 91.1 / 15.2 / 6.1 / 0.5; 30 g whey 117 / 24 / 2.4 / 1.5; skim milk per 100 mL
// 35 / 3.4 / 5 / 0.1.
// The snack keeps the old pre-gym id "P", so earlier days still show their afternoon pick as that day's snack.
window.CHADPlan = [
  {
    id: 'L', name: 'Lunch', time: '12–1 pm',
    choices: [
      { tier: 'S', pinned: true, title: "Nando's ½ PERi chicken", items: ["Nando's ½ PERi-PERi chicken, no sides"],
        how: ["Grab a ½ PERi-PERi chicken at Nando's", 'No sides, bread or mayo'], macros: [715, 108, 1.1, 30.8] },
      { tier: 'M', pinned: true, title: "Gochi + 4 Nando's tenders", items: ['Gochi chicken cup', "4 Nando's PERi-PERi tenders"],
        how: ['Grab a Gochi chicken cup', "Add 4 PERi tenders from Nando's", 'No chips or dips'], macros: [445, 71.4, 25.9, 9.1] },
      { tier: 'F', title: 'Uber Eats: GYG brisket bowl', items: ['Guzman y Gomez Brisket Burrito Bowl, no grain base', 'Extra brisket'],
        how: ['Order a Brisket Burrito Bowl', 'Ask to skip the grain base, add brisket', 'No corn chips or drink'], macros: [630, 66.1, 26.1, 28.9] }
    ]
  },
  {
    id: 'D', name: 'Dinner', time: 'After gym',
    choices: [
      { tier: 'S', title: 'Roast chook & spuds', items: ['250 g hot roast chicken, skin off', '650 g microwave baby potatoes', '1 corn cob', "20 g Nando's PERi-PERi sauce"],
        how: ['Pull 250 g off a hot roast chook, skin off', 'Microwave the spuds 10 min, the corn 4', 'PERi sauce on top'], macros: [1011, 86.6, 126.2, 16.9] },
      { tier: 'M', title: 'Steak & mash + spuds', items: ['Woolworths Pepper Rump Steak With Mash 400 g', '300 g microwave baby potatoes', 'Chobani 20 g Protein Pot', '1 small banana'],
        how: ['Heat the steak & mash 4 min', 'Microwave the spuds 6 min', 'Pot and banana after'], macros: [820, 68, 96.7, 17] },
      { tier: 'F', title: 'Uber Eats: ½ chicken & pita', items: ["Nando's ½ PERi-PERi chicken", '1 pita'],
        how: ["Order a Nando's ½ chicken + a pita", 'Ask for no chips, garlic bread or mayo'], macros: [945, 115.5, 45.1, 33.6] }
    ]
  },
  {
    id: 'P', name: 'Snack', time: 'After dinner · optional',
    choices: [
      { tier: 'S', title: 'YoPRO × 2', items: ['2 YoPRO Vanilla 160 g'],
        how: ['Two YoPRO pots from the fridge', 'Only when protein is still short'], macros: [182.2, 30.4, 12.2, 1] },
      { tier: 'M', title: 'Protein shake', items: ['30 g whey protein', '300 mL skim milk'],
        how: ['Whey into 300 mL skim milk', 'Shake and drink'], macros: [222, 34.2, 17.4, 1.8] },
      { tier: 'F', title: "Uber Eats: Nando's tenders", items: ["4 Nando's PERi-PERi tenders", '+ YoPRO Vanilla 160 g from your fridge'],
        how: ['Order 4 PERi chicken tenders', 'No chips or dips', 'Add a YoPRO from the fridge'], macros: [311.1, 54.8, 6.8, 7] }
    ]
  }
];
