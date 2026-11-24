'use strict';
// Meal-plan inputs only. No personal measurements or source documents. Metric throughout.
// v10: four slots (Breakfast, Lunch, Snack, Dinner), each with exactly three options in a fixed order:
//   Strict  plain whole foods bought or cooked at home: max 5 ingredients, minimal steps, microwave or batch prep
//   Medium  an easy takeaway or a very easy home cook (supermarket premade, grab-and-go)
//   Free    Uber Eats
// Every option: a name, kcal + protein/carbs/fat in grams, and a "how" of at most three steps (takeaway: what to order,
// what to ask for). The Strict day adds up to about 1,900 kcal / 220 P / 150 C / 45 F (the default Cut goals).
// Kept from v9 (same macros): the steak, chook, yoghurt and Nando's/GYG/nata options. The snack keeps the old pre-gym
// id "P" so earlier days still show their snack. "Gochi + 4 Nando's tenders": kcal and protein as given; carbs and fat
// estimated so the energy adds up. New estimates (from product labels and menus, check the pack): the egg scramble and
// the McMuffin.
window.CHADPlan = [
  {
    id: 'B', name: 'Breakfast', time: '7–9 am',
    choices: [
      { tier: 'S', title: 'Egg & ham scramble', items: ['2 eggs', '200 g liquid egg whites', '50 g shaved leg ham', '1 slice wholemeal toast'],
        how: ['Whisk eggs, whites and ham', 'Microwave 2 min, stir, 1 min more', 'Toast on the side'], macros: [387, 47.2, 18.5, 12.7] },
      { tier: 'M', title: 'Protein drink + pot', items: ['Chobani 30 g Protein Drink 400 mL', 'Chobani 20 g Protein Pot'],
        how: ['Straight from the fridge', 'No prep'], macros: [340.6, 50.9, 23.5, 4.4] },
      { tier: 'F', title: 'Uber Eats: Maccas brekkie', items: ["McDonald's Bacon & Egg McMuffin", '+ YoPRO Vanilla 160 g from your fridge'],
        how: ['Order a Bacon & Egg McMuffin, no hash brown', 'Add a YoPRO from the fridge'], macros: [391, 32.6, 32.9, 13.2] }
    ]
  },
  {
    id: 'L', name: 'Lunch', time: '12–1 pm',
    choices: [
      { tier: 'S', title: 'PERi steak & spuds', items: ['250 g Woolworths Lean Beef Strips', '275 g microwave baby potatoes', "20 g Nando's Medium PERi-PERi sauce"],
        how: ['Sear the beef strips 3–4 min', 'Microwave the spuds 8 min', 'Toss with PERi sauce; batch 3 lunches'], macros: [583.5, 60.3, 58.1, 13.7] },
      { tier: 'M', title: 'Steak & mash + pot', items: ['Woolworths Pepper Rump Steak With Mash 400 g', 'Chobani 20 g Protein Pot', '1 small banana'],
        how: ['Heat the steak & mash 4 min', 'Pot and banana on the side'], macros: [595, 62, 49.3, 16.7] },
      { tier: 'F', title: "Uber Eats: Nando's", items: ['¼ PERi chicken (leg)', '1 pita'],
        how: ['Order ¼ chicken leg + pita', 'Ask for no chips, garlic bread or mayo'], macros: [604, 61.3, 50.8, 15.9] }
    ]
  },
  {
    id: 'P', name: 'Snack', time: '3 pm · pre-gym',
    choices: [
      { tier: 'S', title: 'Cinnamon yoghurt bowl', items: ['550 g Woolworths High Protein Plain Yoghurt', '2 g ground cinnamon'],
        how: ['Spoon the yoghurt into a bowl', 'Dust with cinnamon', 'Half at 2:30, half at 3'], macros: [334.8, 51.8, 28.6, 4.1] },
      { tier: 'M', title: "Gochi + 4 Nando's tenders", items: ['1 Gochi', "4 Nando's PERi chicken tenders"],
        how: ['Grab a Gochi', "Order 4 PERi tenders from Nando's, no chips or dips"], macros: [445, 71.4, 14, 11.5] },
      { tier: 'F', title: 'Uber Eats: Naughty Nata', items: ["1 Nando's Naughty Nata", '+ 2 Chobani 20 g Protein Pots from your fridge'],
        how: ['Order 1 Naughty Nata, not the 2-pack', 'Add 2 Chobani pots from the fridge'], macros: [397, 42.8, 39.2, 7.2] }
    ]
  },
  {
    id: 'D', name: 'Dinner', time: 'After gym',
    choices: [
      { tier: 'S', title: 'Roast chook & spuds', items: ['200 g Woolworths hot roast chicken, skin off', '250 g microwave baby potatoes', "20 g Nando's Medium PERi-PERi sauce"],
        how: ['Strip 200 g from a hot roast chook, skin off', 'Microwave the spuds 8 min', 'PERi sauce on top'], macros: [607.8, 62.6, 50.5, 16] },
      { tier: 'M', title: "Nando's pick-up", items: ['¼ PERi chicken (leg)', 'Corn on the cob'],
        how: ['Order ¼ chicken leg + corn for pick-up', 'Ask for no chips, no mayo'], macros: [585, 59.8, 26.6, 24.6] },
      { tier: 'F', title: 'Uber Eats: GYG brisket bowl', items: ['Guzman y Gomez Brisket Burrito Bowl, no grain base', 'Extra brisket'],
        how: ['Order a Brisket Burrito Bowl', 'Ask to skip the grain base and add extra brisket', 'No corn chips or drink'], macros: [630, 66.1, 26.1, 28.9] }
    ]
  }
];
