import type { EventCard } from './types'

// The adult life event deck. R-rated humor: dark, unhinged, never hateful.
// Effects use dollars; positive = you receive, negative = you pay.

export const CARDS: EventCard[] = [
  // =========================================================================
  // RELATIONSHIPS
  // =========================================================================
  {
    id: 'situationship-implosion', category: 'relationships', title: 'Situationship Implosion', requires: 'single',
    flavor: "Six months of 'what are we?' answered by a single text: 'hey so…'",
    effect: { cash: -2_000 },
  },
  {
    id: 'caught-on-apps', category: 'relationships', title: 'Caught on the Apps', requires: 'married',
    flavor: "Your spouse found your 'old' dating profile. It said active 2 hours ago.",
    effect: { divorce: true },
  },
  {
    id: 'vegas-wedding', category: 'relationships', title: 'Rebound Vegas Wedding', requires: 'single',
    flavor: 'What happens in Vegas follows you home wearing a ring.',
    effect: { marry: true, cash: -8_000 },
  },
  {
    id: 'anniversary-amnesia', category: 'relationships', title: 'Anniversary Amnesia', requires: 'married',
    flavor: 'You forgot. The same-day flower delivery upcharge is punitive. So is the silence.',
    effect: { cash: -3_000 },
  },
  {
    id: 'inlaws-move-in', category: 'relationships', title: 'The In-Laws Move In', requires: 'married',
    flavor: "They're here 'for a few weeks.' The guest room has their name on it now. Literally, a plaque.",
    choice: {
      prompt: 'What do you do?',
      options: [
        { id: 'rent', label: 'Charge them rent (+$6k, lose a turn to the chaos)', effect: { cash: 6_000, skipTurn: true } },
        { id: 'hotel', label: 'Pay for their hotel (-$3k, keep your sanity)', effect: { cash: -3_000 } },
      ],
    },
  },
  {
    id: 'dog-custody', category: 'relationships', title: 'Custody of the Dog',
    flavor: 'The breakup was amicable until Biscuit chose you. Now there are lawyers.',
    effect: { cash: -4_000 },
  },
  {
    id: 'wedding-season', category: 'relationships', title: 'Wedding Season',
    flavor: 'Four destination weddings this summer. Zero of them yours.',
    effect: { cash: -8_000 },
  },
  {
    id: 'best-man-speech', category: 'relationships', title: 'Best Man Speech Disaster',
    flavor: 'You mentioned the ex. By name. The open bar went silent.',
    effect: { cash: -2_000 },
  },
  {
    id: 'ghosted', category: 'relationships', title: 'Ghosted', requires: 'single',
    flavor: "They left you on read. Their Spotify says they're thriving.",
    effect: { skipTurn: true },
  },
  {
    id: 'hinge-date', category: 'relationships', title: 'Hinge Date From Hell', requires: 'single',
    flavor: 'They brought a spreadsheet of your red flags. Honestly? It was thorough.',
    effect: { cash: -1_000 },
  },
  {
    id: 'second-honeymoon', category: 'relationships', title: 'Second Honeymoon', requires: 'married',
    flavor: "All-inclusive. You rekindled things. You also drank the minibar into bankruptcy.",
    effect: { cash: -10_000 },
  },
  {
    id: 'baby-fever', category: 'relationships', title: 'Baby Fever', requires: 'married',
    flavor: "One visit to your friend's newborn. That's all it took.",
    effect: { kids: 1, cash: -5_000 },
  },
  {
    id: 'surprise-twins', category: 'relationships', title: 'Surprise Twins', requires: 'married',
    flavor: "The ultrasound tech said 'huh.' You'll never forget the 'huh.'",
    effect: { kids: 2, cash: -10_000 },
  },
  {
    id: 'empty-nest', category: 'relationships', title: 'Empty Nest Windfall', requires: 'kids',
    flavor: 'They moved out! You rent the room to a grad student who pays in cash and sadness.',
    effect: { cash: 6_000 },
  },
  {
    id: 'travel-baseball', category: 'relationships', title: "Kid's Travel Baseball", requires: 'kids',
    flavor: 'A tournament in Sheboygan. Hotel. Gas. $19 stadium Gatorade.',
    effect: { cash: -6_000 },
  },
  {
    id: 'scholarship-kid', category: 'relationships', title: 'Your Kid Got a Scholarship', requires: 'kids',
    flavor: "Somehow, despite everything you've modeled for them, they succeeded.",
    effect: { cash: 10_000 },
  },
  {
    id: 'conscious-uncoupling', category: 'relationships', title: 'Conscious Uncoupling', requires: 'married',
    flavor: 'You announced it on Instagram with a sunset photo and the word "journey." Namaste.',
    effect: { divorce: true },
  },
  {
    id: 'ex-texts', category: 'relationships', title: "The Ex Texts 'u up?'", requires: 'single',
    flavor: "It's 1:47 AM. The typing bubble appears. Disappears. Appears.",
    choice: {
      prompt: 'Do you reply?',
      options: [
        { id: 'reply', label: 'Reply (-$3k in brunch apologies, lose a turn)', effect: { cash: -3_000, skipTurn: true } },
        { id: 'block', label: 'Block them (+$2k worth of inner peace)', effect: { cash: 2_000 } },
      ],
    },
  },
  {
    id: 'office-romance', category: 'relationships', title: 'Office Romance', requires: 'career',
    flavor: 'HR has questions. So does the group chat. The group chat is worse.',
    effect: { cash: -3_000 },
  },
  {
    id: 'joint-account', category: 'relationships', title: 'Joint Bank Account', requires: 'married',
    flavor: "You can see everything now. EVERYTHING. What is 'Sweet Treats R Us' and why is it weekly?",
    effect: { cash: -2_000 },
  },

  // =========================================================================
  // VICES
  // =========================================================================
  {
    id: 'blackout-brunch', category: 'vices', title: 'Blackout Brunch',
    flavor: "Bottomless mimosas were a challenge, not an offer. You treated them as a challenge.",
    effect: { cash: -2_000, skipTurn: true },
  },
  {
    id: 'dui', category: 'vices', title: 'DUI',
    flavor: 'The Uber home was $14. The lawyer is $12,000. Math has never been crueler.',
    effect: { cash: -12_000, skipTurn: true },
  },
  {
    id: 'edibles-at-work', category: 'vices', title: 'Edibles Kicked In at Work', requires: 'career',
    flavor: 'You told your manager the truth. All of it. Including the part about their haircut.',
    effect: { cash: -3_000 },
  },
  {
    id: 'wine-mom', category: 'vices', title: 'Wine O\'Clock Era',
    flavor: "'It's just a little treat' is somehow $400 a month.",
    effect: { cash: -5_000 },
  },
  {
    id: 'sober-october', category: 'vices', title: 'Sober October Victory',
    flavor: "You did it. You're insufferable about it. Your liver sends a fruit basket.",
    effect: { cash: 3_000 },
  },
  {
    id: 'casino-comps', category: 'vices', title: 'Casino Comps',
    flavor: "The pit boss knows your name. That's a bad sign, but tonight it's a free suite.",
    effect: { cash: 4_000 },
  },
  {
    id: 'hangover-monday', category: 'vices', title: 'Hangover Monday',
    flavor: "You called in 'sick.' Your boss watched your story from the concert. Twice.",
    effect: { skipTurn: true },
  },
  {
    id: 'round-for-the-bar', category: 'vices', title: 'Bought a Round for the Bar',
    flavor: "'PUT IT ON MY TAB,' you screamed, beautifully, to a full house.",
    effect: { cash: -3_000 },
  },
  {
    id: 'lost-vape', category: 'vices', title: 'The Vape Vanishes',
    flavor: 'You bought a $180 vape. It lived in a couch cushion within 48 hours. They always do.',
    effect: { cash: -2_000 },
  },
  {
    id: 'beer-league', category: 'vices', title: 'Beer League Champions',
    flavor: 'Your rec softball team won it all. The trophy is a toilet seat. The bar tab was comped.',
    effect: { cash: 1_000 },
  },
  {
    id: 'golf-cart-pond', category: 'vices', title: 'Day Drinking Golf',
    flavor: '18 holes, 36 beers, one (1) golf cart in a pond.',
    effect: { cash: -6_000 },
  },
  {
    id: 'dry-january', category: 'vices', title: 'Dry January Ends Jan 3rd',
    flavor: 'A new personal record: 72 hours.',
    effect: { cash: -1_000 },
  },
  {
    id: 'nashville-bachelorette', category: 'vices', title: 'Bachelorette in Nashville',
    flavor: "Pedal tavern. Cowboy hats. A tattoo you'll be discussing in therapy.",
    effect: { cash: -7_000 },
  },
  {
    id: 'poker-night', category: 'vices', title: 'High-Stakes Poker Night',
    flavor: "Dave says he's 'never played before.' Dave has sunglasses on. Indoors. At night.",
    choice: {
      prompt: 'How do you play it?',
      options: [
        { id: 'fold', label: 'Fold early, keep your money', effect: {} },
        { id: 'shove', label: 'Shove all-in (win $15k or lose $10k)', effect: { gamble: { win: 15_000, lose: 10_000 } } },
      ],
    },
  },
  {
    id: 'mystery-shots', category: 'vices', title: 'Mystery Shot Roulette',
    flavor: "The bartender said 'trust me.' You did. You shouldn't have. Or should you?",
    effect: { gamble: { win: 2_000, lose: 4_000 } },
  },
  {
    id: 'hot-ones', category: 'vices', title: 'Hot Ones Challenge at Home',
    flavor: 'Da Bomb. Emergency milk run. You saw through time.',
    effect: { cash: -1_000 },
  },
  {
    id: 'natural-wine', category: 'vices', title: 'Natural Wine Phase',
    flavor: "It tastes like kombucha's evil twin and costs like champagne. You pretend to love it.",
    effect: { cash: -4_000 },
  },
  {
    id: 'dd-karma', category: 'vices', title: 'Designated Driver Karma',
    flavor: 'You drove everyone home for a year. The group finally Venmo\'d you back. With interest.',
    effect: { cash: 3_000 },
  },

  // =========================================================================
  // MONEY
  // =========================================================================
  {
    id: 'rug-pull', category: 'money', title: 'Crypto Rug Pull',
    flavor: '$GOODBOI was going to the moon. The dev went to Bali.',
    effect: { cash: -15_000 },
  },
  {
    id: 'meme-stock', category: 'money', title: 'Meme-Stock Windfall',
    flavor: "You YOLO'd and it WORKED?? Delete the app. Cash out. Never speak of this.",
    effect: { cash: 20_000 },
  },
  {
    id: 'loan-capitalizes', category: 'money', title: 'Student Loan Interest Capitalizes',
    flavor: 'A letter arrives. The number has grown. The number is alive. The number hungers.',
    effect: { debt: 10_000 },
  },
  {
    id: 'bnpl-reckoning', category: 'money', title: 'Buy-Now-Pay-Later Reckoning',
    flavor: 'All four easy installments of everything you own arrived in the same week.',
    effect: { cash: -6_000 },
  },
  {
    id: 'tax-refund', category: 'money', title: 'Surprise Tax Refund',
    flavor: 'You did nothing different this year, but the IRS apologized?? Do not question it.',
    effect: { cash: 5_000 },
  },
  {
    id: 'identity-theft', category: 'money', title: 'Identity Theft',
    flavor: 'Someone bought a jet ski in your name in Tampa. Of course it was Tampa.',
    effect: { cash: -8_000 },
  },
  {
    id: 'emergency-fund', category: 'money', title: 'Emergency Fund? Never Heard of Her',
    flavor: 'Transmission. Water heater. Root canal. Same week. The universe has a group chat.',
    effect: { cash: -9_000 },
  },
  {
    id: 'airbnb-hustle', category: 'money', title: 'Airbnb Side Hustle', requires: 'house',
    flavor: 'Strangers pay to sleep in your house and leave reviews about your throw pillows.',
    effect: { cash: 8_000 },
  },
  {
    id: 'hoa-assessment', category: 'money', title: 'HOA Special Assessment', requires: 'house',
    flavor: 'The gazebo nobody wanted needs repairs nobody approved, and you\'re paying for it.',
    effect: { cash: -5_000 },
  },
  {
    id: 'rent-hike', category: 'money', title: 'Rent Went Up Again',
    flavor: "The landlord calls it a 'market adjustment.' The market is him. He is adjusting you.",
    effect: { cash: -4_000 },
  },
  {
    id: 'coat-money', category: 'money', title: 'Found Money in an Old Coat',
    flavor: "Past you left present you a gift. Past you was drunk, but thoughtful.",
    effect: { cash: 1_000 },
  },
  {
    id: 'class-action', category: 'money', title: 'Class Action Settlement',
    flavor: 'That app sold your data for years. Your cut: enough for one nice dinner.',
    effect: { cash: 2_000 },
  },
  {
    id: 'worthless-nft', category: 'money', title: 'Your NFT Is Worthless',
    flavor: 'You bought it at a party to seem interesting. The ape stares back, mocking you.',
    effect: { cash: -3_000 },
  },
  {
    id: 'venmo-2019', category: 'money', title: 'Venmo Request From 2019',
    flavor: "'hey!! finally getting around to splitting that trip 👉👈'",
    effect: { cash: -2_000 },
  },
  {
    id: 'grandma-inheritance', category: 'money', title: "Grandma's Inheritance",
    flavor: 'She left you the good china and a genuinely shocking brokerage account.',
    effect: { cash: 25_000 },
  },
  {
    id: 'timeshare', category: 'money', title: 'Timeshare Presentation',
    flavor: "'Just 90 minutes of your time' for a free vacation. The doors have locks.",
    choice: {
      prompt: 'Do you sit through it?',
      options: [
        { id: 'sit', label: 'Endure it (+$3k in freebies, lose a turn)', effect: { cash: 3_000, skipTurn: true } },
        { id: 'run', label: 'Fake an emergency and run', effect: {} },
      ],
    },
  },
  {
    id: 'parlay', category: 'money', title: 'Sports Betting Parlay',
    flavor: "One leg away. It's always one leg away.",
    effect: { gamble: { win: 12_000, lose: 8_000 } },
  },
  {
    id: 'storage-auction', category: 'money', title: 'Storage Unit Auction',
    flavor: "It's either vintage Rolexes or a box of someone else's grief. Only one way to find out.",
    effect: { gamble: { win: 8_000, lose: 2_000 } },
  },
  {
    id: 'bank-fees', category: 'money', title: 'Fees for Having Fees',
    flavor: 'Your bank now charges a maintenance fee on the account they charge maintenance fees to.',
    effect: { cash: -1_000 },
  },
  {
    id: '401k-dip', category: 'money', title: '401(k)? More Like 401(nope)',
    flavor: 'You checked it during the dip. Why did you check it. Never check it.',
    effect: { cash: -5_000 },
  },

  // =========================================================================
  // INTERNET
  // =========================================================================
  {
    id: 'tiktok-viral', category: 'internet', title: 'Your TikTok Goes Viral',
    flavor: 'Your sandwich tutorial hit 4 million views. Brands are sliding into the DMs.',
    effect: { cash: 12_000 },
  },
  {
    id: 'cancelled', category: 'internet', title: 'Cancelled on X',
    flavor: 'A 2014 tweet resurfaced. The Notes-app apology screenshot made everything worse.',
    effect: { cash: -8_000, skipTurn: true },
  },
  {
    id: 'group-chat-leak', category: 'internet', title: 'Doxxed by the Group Chat',
    flavor: 'Someone leaked the chat. You said what you said.',
    effect: { cash: -5_000 },
  },
  {
    id: 'gummy-ad', category: 'internet', title: 'Sponsored Gummy Post',
    flavor: 'One (1) sponsored post about wellness gummies. Dignity: gone. Rent: paid.',
    effect: { cash: 8_000 },
  },
  {
    id: 'eras-lottery', category: 'internet', title: 'You Won the Eras Tour Ticket Lottery',
    flavor: 'Face value. Floor seats. Your group chat is vibrating.',
    choice: {
      prompt: 'What do you do with the tickets?',
      options: [
        { id: 'scalp', label: 'Scalp them (+$10k, eternal shame)', effect: { cash: 10_000 } },
        { id: 'go', label: 'Go (-$4k on outfits & friendship bracelets)', effect: { cash: -4_000 } },
      ],
    },
  },
  {
    id: 'ai-took-job', category: 'internet', title: 'AI Took Your Job', requires: 'career',
    flavor: 'Replaced by a chatbot that hallucinates less than your boss. Time for a pivot.',
    effect: { newCareer: true, cash: -3_000 },
  },
  {
    id: 'reply-guy', category: 'internet', title: 'You Became a Reply Guy',
    flavor: 'Six hours a day arguing with strangers named @PatriotEagle1776_2. Productivity: zero.',
    effect: { skipTurn: true },
  },
  {
    id: 'wordle-streak', category: 'internet', title: 'Wordle Streak Dies at 847',
    flavor: "You're not okay. You bought the premium puzzle bundle to cope.",
    effect: { cash: -1_000 },
  },
  {
    id: 'zoom-potato', category: 'internet', title: 'Your Zoom Filter Was On', requires: 'career',
    flavor: 'You delivered the quarterly review as a potato. Respect: mixed. Memes: eternal.',
    effect: { cash: -2_000 },
  },
  {
    id: 'podcast-startup', category: 'internet', title: 'Started a Podcast',
    flavor: 'Two episodes. You and your co-host no longer speak. The mics were $800.',
    effect: { cash: -3_000 },
  },
  {
    id: 'twitch-sleep', category: 'internet', title: 'Fell Asleep on Stream',
    flavor: 'It became your most-watched content. Donations poured in. You slept through all of it.',
    effect: { cash: 4_000 },
  },
  {
    id: 'boarding-pass', category: 'internet', title: 'Phone Died at 3% During Boarding',
    flavor: 'You printed the pass at a hotel business center like a pilgrim from 2006.',
    effect: { cash: -1_000 },
  },
  {
    id: 'smart-home', category: 'internet', title: 'Smart Home Rebellion',
    flavor: "The thermostat locked you out. It's 84 degrees. The speaker is laughing softly.",
    effect: { cash: -2_000 },
  },
  {
    id: 'bereal-wendys', category: 'internet', title: 'BeReal at the Worst Time',
    flavor: "It caught you crying in a Wendy's parking lot. Authenticity: achieved.",
    effect: { cash: -1_000 },
  },
  {
    id: 'fantasy-league', category: 'internet', title: 'Fantasy League Champion',
    flavor: "The commissioner's cut is yours. You have peaked. It's all downhill from here.",
    effect: { cash: 5_000 },
  },
  {
    id: 'linkedin-grind', category: 'internet', title: 'LinkedIn Influencer Arc',
    flavor: "You posted 'What my divorce taught me about B2B sales.' It WORKED??",
    effect: { cash: 6_000 },
  },
  {
    id: 'resin-coasters', category: 'internet', title: 'The Algorithm Blessed You',
    flavor: 'Your resin coaster side hustle is suddenly everywhere. Ride the wave, artisan.',
    effect: { cash: 9_000 },
  },
  {
    id: 'password1', category: 'internet', title: 'Data Breach',
    flavor: "Your password was 'password1'. The 1 was for security.",
    effect: { cash: -4_000 },
  },
  {
    id: 'doomscroll', category: 'internet', title: 'Doomscrolled Till 4 AM',
    flavor: 'You know everything about a submarine now. You have a meeting in four hours.',
    effect: { skipTurn: true },
  },
  {
    id: 'became-meme', category: 'internet', title: 'Viral for the Wrong Reason',
    flavor: "You're a meme now. Your face means 'confused idiot.' Grandma shared it.",
    effect: { cash: -3_000 },
  },
  {
    id: 'deepfake-scam', category: 'internet', title: 'Deepfake Scam Call',
    flavor: "'Grandma, it's me!' It was NOT you. She wired them your inheritance advance.",
    effect: { cash: -6_000 },
  },

  // =========================================================================
  // NEWS / POLITICS
  // =========================================================================
  {
    id: 'jury-duty', category: 'news', title: 'Jury Duty',
    flavor: "Two weeks. A man named Chad will not stop talking about jet fuel. You get $40 a day.",
    effect: { cash: 1_000, skipTurn: true },
  },
  {
    id: 'stimulus', category: 'news', title: 'Stimulus Check',
    flavor: 'A check from the government. The economy did something. Nobody can explain what.',
    effect: { cash: 2_000 },
  },
  {
    id: 'tariff-dropship', category: 'news', title: 'Tariffs Killed Your Dropshipping',
    flavor: 'Your $8 gadget now costs $34 to import. The passive-income dream is dead.',
    effect: { cash: -7_000 },
  },
  {
    id: 'loan-forgiveness', category: 'news', title: 'Student Loan Forgiveness!',
    flavor: 'It was forgiven! (It was un-forgiven while you were reading this card.)',
    effect: {},
  },
  {
    id: 'election-thanksgiving', category: 'news', title: 'Election Year Thanksgiving',
    flavor: 'Your uncle started it. You finished it. Therapy for the whole table, your treat.',
    effect: { cash: -3_000 },
  },
  {
    id: 'congress-trades', category: 'news', title: "Copied Your Congressman's Stock Picks",
    flavor: 'Suspiciously excellent returns. Almost like someone knew something.',
    effect: { cash: 8_000 },
  },
  {
    id: 'gas-prices', category: 'news', title: 'Gas Prices Did a Thing',
    flavor: 'You now have opinions about crude oil futures. Loud ones. At parties.',
    effect: { cash: -2_000 },
  },
  {
    id: 'egg-prices', category: 'news', title: 'The Egg Situation',
    flavor: "You now say 'the eggs are for guests.'",
    effect: { cash: -1_000 },
  },
  {
    id: 'tiktok-ban', category: 'news', title: 'TikTok Ban Scare',
    flavor: "You moved your following to an app called ClipClop. It folded in nine days.",
    effect: { cash: -4_000 },
  },
  {
    id: 'canvasser', category: 'news', title: 'Canvasser Guilt Donation',
    flavor: 'They had a clipboard and college debt. You had a moment of weakness.',
    effect: { cash: -1_000 },
  },
  {
    id: 'local-news', category: 'news', title: 'Featured on Local News',
    flavor: "'AREA ADULT PAYS BILLS ON TIME.' You frame the screenshot. Hero arc.",
    effect: { cash: 2_000 },
  },
  {
    id: 'debate-drinking', category: 'news', title: 'Debate Night Drinking Game',
    flavor: 'One sip per buzzword. You were unconscious by the second question.',
    effect: { skipTurn: true },
  },
  {
    id: 'chaos-bet', category: 'news', title: 'Won a Political Bet',
    flavor: 'You bet on chaos. Chaos delivered. Chaos always delivers.',
    effect: { cash: 4_000 },
  },
  {
    id: 'state-slogan', category: 'news', title: 'Won the State Slogan Contest',
    flavor: "Your ironic entry won. It's on the license plates now. You can never explain the joke.",
    effect: { cash: 3_000 },
  },
  {
    id: 'conspiracy-uncle', category: 'news', title: "Your Uncle's Podcast",
    flavor: "You appear in episode 341: 'My Nibling, the Sheep.' It has 40,000 downloads.",
    effect: { cash: -1_000 },
  },

  // =========================================================================
  // CAREER
  // =========================================================================
  {
    id: 'promotion', category: 'career', title: 'Promotion!', requires: 'career',
    flavor: "More money, more meetings that could've been emails about meetings.",
    effect: { salaryPct: 20 },
  },
  {
    id: 'restructuring', category: 'career', title: "Laid Off: 'Restructuring'", requires: 'career',
    flavor: 'The new org chart was a circle, and you were outside it.',
    effect: { newCareer: true, cash: -2_000 },
  },
  {
    id: 'quiet-quitting', category: 'career', title: 'Quiet Quitting Caught', requires: 'career',
    flavor: 'You were doing the bare minimum. So was your boss. You made eye contact.',
    effect: { salaryPct: -10 },
  },
  {
    id: 'etsy-takeoff', category: 'career', title: 'Side Hustle Takes Off',
    flavor: 'The Etsy shop out-earned your job this month. The candles smell like validation.',
    effect: { cash: 7_000 },
  },
  {
    id: 'rto-mandate', category: 'career', title: 'RTO Mandate', requires: 'career',
    flavor: 'Return to office. Gas, lunches, pants with buttons. Civilization has a price.',
    effect: { cash: -4_000 },
  },
  {
    id: 'work-bestie-left', category: 'career', title: 'Your Work Bestie Quit', requires: 'career',
    flavor: 'Your only reason to attend meetings is gone. Morale: rubble. Slack: silent.',
    effect: { cash: -1_000 },
  },
  {
    id: 'bonus-season', category: 'career', title: 'Bonus Season', requires: 'career',
    flavor: 'The number was almost what they hinted at in March. Almost.',
    effect: { cash: 6_000 },
  },
  {
    id: 'vegas-conference', category: 'career', title: 'Conference in Vegas', requires: 'career',
    flavor: "'It's for networking,' you tell everyone, including yourself.",
    choice: {
      prompt: 'How do you spend the trip?',
      options: [
        { id: 'network', label: 'Actually network (+$5k in new business)', effect: { cash: 5_000 } },
        { id: 'casino', label: 'The casino floor (win $10k or lose $8k)', effect: { gamble: { win: 10_000, lose: 8_000 } } },
      ],
    },
  },
  {
    id: 'boss-tiktok', category: 'career', title: 'Your Boss Found Your TikTok', requires: 'career',
    flavor: "Delete the 'day in my life: pretending to work' series. Delete it now.",
    effect: { cash: -1_000 },
  },
  {
    id: 'union', category: 'career', title: 'Union Formed', requires: 'career',
    flavor: 'Solidarity! Also: dental.',
    effect: { salaryPct: 10 },
  },
  {
    id: 'pip', category: 'career', title: 'Performance Improvement Plan', requires: 'career',
    flavor: 'A PIP is a breakup letter with deadlines.',
    effect: { salaryPct: -10 },
  },
  {
    id: 'freelance-paid', category: 'career', title: 'Freelance Client Finally Paid',
    flavor: "Invoice #47, ninety days late, with a 'sorry for the delay!!' and no late fee.",
    effect: { cash: 5_000 },
  },
  {
    id: 'burnout', category: 'career', title: 'Burnout', requires: 'career',
    flavor: 'You reheated the same coffee four times and cried at a printer.',
    choice: {
      prompt: 'How do you handle it?',
      options: [
        { id: 'sabbatical', label: 'Sabbatical (-$6k, lose a turn, find yourself)', effect: { cash: -6_000, skipTurn: true } },
        { id: 'push', label: 'Push through (-$2k in stress spending)', effect: { cash: -2_000 } },
      ],
    },
  },
  {
    id: 'poached', category: 'career', title: 'You Got Poached', requires: 'career',
    flavor: "A recruiter called you a 'rockstar.' You said 'how much.' Beautiful negotiation.",
    effect: { salaryPct: 15 },
  },
  {
    id: 'expense-audit', category: 'career', title: 'Expense Report Audit', requires: 'career',
    flavor: "'Team morale sushi' for one person was a bold line item.",
    effect: { cash: -3_000 },
  },

  // =========================================================================
  // HEALTH / MISC
  // =========================================================================
  {
    id: 'therapy-works', category: 'health', title: 'Therapy Is Working',
    flavor: "You said 'that's a boundary' out loud. To a person. Growth is expensive.",
    effect: { cash: -3_000 },
  },
  {
    id: 'ghost-gym', category: 'health', title: 'The Gym Membership',
    flavor: "$45 a month since 2022. The app just sent a 'we miss you' notification.",
    effect: { cash: -2_000 },
  },
  {
    id: 'marathon', category: 'health', title: 'Ran a Marathon',
    flavor: '26.2 sticker acquired. Toenails: eight of ten remaining.',
    effect: { cash: -1_000 },
  },
  {
    id: 'thirty-crisis', category: 'health', title: '30th Birthday Crisis',
    flavor: 'You bought a leather jacket and looked up grad schools at 2 AM.',
    effect: { cash: -3_000 },
  },
  {
    id: 'glp1-copay', category: 'health', title: 'The GLP-1 Copay',
    flavor: 'The shot works. The copay also works — on your wallet, weekly.',
    effect: { cash: -5_000 },
  },
  {
    id: 'pickleball', category: 'health', title: 'Pickleball Injury',
    flavor: "You tore something 'dinking.' The ER doctor tried so hard not to laugh.",
    effect: { cash: -6_000 },
  },
  {
    id: 'sleep-study', category: 'health', title: 'Sleep Study Results',
    flavor: "Turns out you don't sleep — you 'practice dying nightly,' per the technician.",
    effect: { cash: -3_000 },
  },
  {
    id: 'cold-plunge', category: 'health', title: 'Cold Plunge Convert',
    flavor: 'You bought a $2,000 tub of ice water. You feel amazing and sound insufferable.',
    effect: { cash: -2_000 },
  },
  {
    id: 'good-dentist', category: 'health', title: 'Found a Great Dentist',
    flavor: 'No lecture. Gentle hands. Insurance actually covered it. You cried a little.',
    effect: { cash: 1_000 },
  },
  {
    id: 'webmd-spiral', category: 'health', title: 'WebMD Spiral',
    flavor: 'Symptom: headache. Diagnosis: everything. Copay to learn it was stress: $250.',
    effect: { cash: -1_000 },
  },
  {
    id: 'hot-yoga-cult', category: 'health', title: 'Hot Yoga Cult(ure)',
    flavor: "The instructor 'saw your aura.' The retreat costs $4k. You're already packing.",
    effect: { cash: -4_000 },
  },
  {
    id: 'rescue-dog', category: 'health', title: 'Adopted a Rescue Dog',
    flavor: "He's a very good boy. He ate one (1) entire couch.",
    effect: { cash: -3_000 },
  },
  {
    id: 'meal-prep', category: 'health', title: 'Meal Prep Sunday',
    flavor: 'Fourteen containers of sad chicken. DoorDash by Wednesday.',
    effect: { cash: -2_000 },
  },
  {
    id: 'true-crime', category: 'health', title: 'True Crime Paranoia',
    flavor: "You bought three doorbell cameras and a taser you've named Susan.",
    effect: { cash: -2_000 },
  },
  {
    id: 'vitamin-quiz', category: 'health', title: 'Personalized Vitamin Scam',
    flavor: 'Vitamins tailored to you, based on a quiz. The quiz was four questions.',
    effect: { cash: -1_000 },
  },
  {
    id: 'screen-time', category: 'health', title: 'Screen Time Report',
    flavor: "Sunday, 9 AM: 'Your daily average was 11 hours.' Nothing happens. You simply carry this knowledge forever.",
    effect: {},
  },
  {
    id: 'sourdough', category: 'health', title: 'The Sourdough Starter Lives',
    flavor: "You've kept it alive since 2020. It has a name. It gets fed before you do.",
    effect: { cash: -1_000 },
  },
  {
    id: 'parallel-parking', category: 'health', title: 'Parallel Parking Disaster',
    flavor: 'Fourteen witnesses. One crumpled bumper. A slow, respectful clap.',
    effect: { cash: -2_000 },
  },
  {
    id: 'insurance-ad', category: 'health', title: 'That Insurance Jingle Worked',
    flavor: 'Fifteen minutes on the phone actually did save you money. The jingle was right all along.',
    effect: { insurance: true },
  },
  {
    id: 'walk-of-shame', category: 'health', title: 'Walk of Shame',
    flavor: "Last night's outfit, this morning's sunlight, a neighbor's slow nod.",
    effect: { move: -3 },
  },
  {
    id: 'main-character', category: 'health', title: 'Main Character Energy',
    flavor: 'You woke up and chose momentum. Nothing can stop you today.',
    effect: { move: 3 },
  },

  // =========================================================================
  // MESSY DIVORCE ARC (v2)
  // =========================================================================
  {
    id: 'the-papers', category: 'relationships', title: 'You Got Served', requires: 'married',
    flavor: 'At brunch. In front of everyone. The mimosa went warm while you read.',
    choice: {
      prompt: 'How messy are we going?',
      options: [
        { id: 'lawyer', label: 'Lawyer up (-$15k, keep 75%)', effect: { cash: -15_000, divorce: true, divorcePct: 25 } },
        { id: 'amicable', label: 'Amicable split (lose half)', effect: { divorce: true, divorcePct: 50 } },
        { id: 'hide', label: 'Hide assets in crypto (risky)', effect: { divorce: true, divorcePct: 30, gamble: { win: 5_000, lose: 25_000 } } },
      ],
    },
  },
  {
    id: 'spouse-podcast', category: 'relationships', title: "Your Ex's New Podcast", requires: 'married',
    flavor: "Episode 1: 'Everything They Did.' It's charting. You're the content now.",
    effect: { divorce: true, divorcePct: 55, cash: -3_000 },
  },
  {
    id: 'airfryer-custody', category: 'relationships', title: 'Custody of the Air Fryer', requires: 'married',
    flavor: 'The house? Fine. The dog? Shared. The air fryer? WAR.',
    effect: { divorce: true, skipTurn: true },
  },
  {
    id: 'vow-renewal', category: 'relationships', title: 'Vow Renewal', requires: 'married',
    flavor: 'Second wedding, second registry, second gift grab. Diabolical. Respect.',
    effect: { cash: -6_000, collectFromEach: 1_000 },
  },
  {
    id: 'marriage-counseling', category: 'relationships', title: 'Marriage Counseling', requires: 'married',
    flavor: "The therapist asked 'and how does that make you feel?' and your spouse took NOTES.",
    choice: {
      prompt: 'Do the work?',
      options: [
        { id: 'go', label: 'Go weekly (-$8k, it works)', effect: { cash: -8_000 } },
        { id: 'fine', label: "Insist you're fine (divorce)", effect: { divorce: true } },
      ],
    },
  },

  // =========================================================================
  // DIVORCED LIFE (v2)
  // =========================================================================
  {
    id: 'alimony', category: 'relationships', title: 'Alimony Day', requires: 'divorced',
    flavor: 'The first of the month comes for you like clockwork. Because it is clockwork.',
    effect: { cash: -5_000 },
  },
  {
    id: 'ex-glow-up', category: 'relationships', title: 'The Ex Glow-Up', requires: 'divorced',
    flavor: 'They look incredible. You bought a Peloton at 1 AM about it.',
    effect: { cash: -3_000 },
  },
  {
    id: 'same-wedding', category: 'relationships', title: "Both Invited to Dana's Wedding", requires: 'divorced',
    flavor: 'Same table. Dana did it on purpose. Dana is thriving on this.',
    effect: { cash: -2_000 },
  },
  {
    id: 'rebound-remarriage', category: 'relationships', title: 'Chaos Remarriage', requires: 'divorced',
    flavor: 'You met in the HOA dispute Facebook group. It’s chaos. It’s love. It’s both.',
    effect: { marry: true, cash: -5_000 },
  },
  {
    id: 'dating-app-relaunch', category: 'relationships', title: 'Profile Relaunch', requires: 'divorced',
    flavor: "Bio: 'divorced, thriving.' The algorithm knows only one of those is true.",
    effect: { cash: -1_000 },
  },
  {
    id: 'half-the-vinyl', category: 'relationships', title: 'Half the Record Collection', requires: 'divorced',
    flavor: "Turns out half of 'our' vinyl was collectible. Your half. Sold.",
    effect: { cash: 6_000 },
  },

  // =========================================================================
  // DEBT LIFE (v2)
  // =========================================================================
  {
    id: 'collections-call', category: 'money', title: 'Unknown Number', requires: 'debt',
    flavor: 'You answered an unknown number. Rookie mistake. They found you.',
    effect: { cash: -3_000 },
  },
  {
    id: 'debt-consolidation', category: 'money', title: 'Consolidation Offer', requires: 'debt',
    flavor: 'One easy payment! The word "easy" is doing federal-crime levels of work here.',
    choice: {
      prompt: 'Deal with it?',
      options: [
        { id: 'pay', label: 'Pay $10k now, erase $15k of debt', effect: { cash: -10_000, debt: -15_000 } },
        { id: 'ignore', label: 'Future you can handle it (+$5k debt)', effect: { debt: 5_000 } },
      ],
    },
  },
  {
    id: 'credit-score-drop', category: 'money', title: 'Credit Score Update', requires: 'debt',
    flavor: 'It dropped so hard the app sent a condolence emoji.',
    effect: { cash: -2_000 },
  },
  {
    id: 'budgeting-arc', category: 'money', title: 'Budgeting Video Rabbit Hole', requires: 'debt',
    flavor: 'You watched 40 finance videos and actually did one (1) thing. It worked.',
    effect: { debt: -10_000 },
  },

  // =========================================================================
  // HOUSING DRAMA (v2)
  // =========================================================================
  {
    id: 'mold-walls', category: 'money', title: 'The Character Was Mold', requires: 'house',
    flavor: "The 'character' smell? Black mold. The character was load-bearing.",
    effect: { cash: -8_000 },
  },
  {
    id: 'squatters', category: 'money', title: 'Squatters', requires: 'house',
    flavor: 'You went on vacation. Someone else went on living in your house.',
    effect: { cash: -6_000, skipTurn: true },
  },
  {
    id: 'refinance-win', category: 'money', title: 'Refinance Jackpot', requires: 'house',
    flavor: 'You refinanced at the exact right week. Genius or blind luck — say genius.',
    effect: { cash: 7_000 },
  },
  {
    id: 'hgtv-brain', category: 'money', title: 'HGTV Brain', requires: 'house',
    flavor: 'You watched ONE renovation show. The kitchen wall is gone now. It was structural.',
    effect: { cash: -9_000 },
  },
  {
    id: 'property-reassess', category: 'money', title: 'Property Tax Reassessment', requires: 'house',
    flavor: 'The county noticed your house exists harder than it used to.',
    effect: { cash: -4_000 },
  },
  {
    id: 'hoa-coup', category: 'money', title: 'HOA Coup', requires: 'house',
    flavor: 'You seized power in the HOA. The gazebo WILL be repainted. Petty cash: yours.',
    effect: { cash: 3_000 },
  },
  {
    id: 'zillow-2am', category: 'money', title: '2 AM Zillow Spiral', requires: 'renter',
    flavor: 'You browse mansions at 2 AM and feel feelings. The app knows. It sends more.',
    effect: { cash: -1_000 },
  },
  {
    id: 'landlord-sells', category: 'money', title: 'New Landlord', requires: 'renter',
    flavor: "The building sold. 'Minor updates' means your rent, doubled, and a worse gym.",
    effect: { cash: -5_000 },
  },
  {
    id: 'deposit-back', category: 'money', title: 'Full Deposit Returned', requires: 'renter',
    flavor: 'A FULL security deposit back. Frame the check. Historians will want it.',
    effect: { cash: 3_000 },
  },
  {
    id: 'roommate-crypto', category: 'money', title: 'Roommate Paid Rent in Crypto', requires: 'renter',
    flavor: "Technically he paid. Technically it's gone. Technically you're covering it.",
    effect: { cash: -4_000 },
  },

  // =========================================================================
  // LOTTERY / CASINO / MONEY (v2)
  // =========================================================================
  {
    id: 'scratch-habit', category: 'money', title: 'The Scratch-Off Habit',
    flavor: "A daily 'little treat' from the gas station. The treats do not scratch back.",
    effect: { cash: -3_000 },
  },
  {
    id: 'office-pool', category: 'money', title: 'Office Pool Hits',
    flavor: 'The office lottery pool HIT. Twelve ways is still real money. Kevin cried.',
    effect: { cash: 8_000 },
  },
  {
    id: 'casino-heater', category: 'money', title: 'The Heater',
    flavor: 'The table was hot and you were hotter. Were. Past tense pending.',
    effect: { gamble: { win: 15_000, lose: 5_000 } },
  },
  {
    id: 'cold-streak', category: 'money', title: 'The Cold Streak',
    flavor: "You swore you'd stop at $500 down. You did not stop at $500 down.",
    effect: { cash: -7_000 },
  },
  {
    id: 'one-more-hand', category: 'money', title: 'One More Hand',
    flavor: "You're up. The dealer smiles. Everyone at this table has made this mistake.",
    choice: {
      prompt: 'Walk or ride?',
      options: [
        { id: 'walk', label: 'Walk away up $2k', effect: { cash: 2_000 } },
        { id: 'stay', label: 'One more hand (double or nothing)', effect: { gamble: { win: 12_000, lose: 12_000 } } },
      ],
    },
  },
  {
    id: 'wsb-yolo', category: 'money', title: '0DTE Options',
    flavor: 'The subreddit said it couldn’t go tits up. The subreddit lied before. Still…',
    choice: {
      prompt: 'Deploy the rent money?',
      options: [
        { id: 'lurk', label: 'Just lurk', effect: {} },
        { id: 'yolo', label: 'YOLO (win $25k / lose $20k)', effect: { gamble: { win: 25_000, lose: 20_000 } } },
      ],
    },
  },
  {
    id: 'boat-will', category: 'money', title: 'The Boat Dispute',
    flavor: "Your cousin is contesting the will over a boat. Nobody wanted the boat until now.",
    effect: { cash: -5_000 },
  },
  {
    id: 'roundup-app', category: 'money', title: 'Round-Up Savings',
    flavor: 'That app rounding up your coffees quietly saved you a fortune. Delete nothing.',
    effect: { cash: 4_000 },
  },
  {
    id: 'overdraft-cascade', category: 'money', title: 'Overdraft Cascade',
    flavor: 'One $6 latte triggered four $35 fees. The bank calls this "a service."',
    effect: { cash: -2_000 },
  },
  {
    id: 'goodboi-returns', category: 'money', title: '$GOODBOI Rises Again',
    flavor: 'It… came back?? SELL. SELL NOW. DO NOT READ THE DISCORD. SELL.',
    effect: { cash: 10_000 },
  },
  {
    id: 'audit-home-office', category: 'money', title: 'The Audit Letter',
    flavor: "The IRS has questions about your 'home office' (a couch, legally speaking).",
    effect: { cash: -6_000 },
  },
  {
    id: 'tax-guy', category: 'money', title: 'The New Tax Guy',
    flavor: "He found deductions you're choosing not to ask questions about.",
    effect: { cash: 6_000 },
  },

  // =========================================================================
  // KIDS & FAMILY CHAOS (v2)
  // =========================================================================
  {
    id: 'teen-totals-car', category: 'relationships', title: 'The Mailbox Incident', requires: 'kids',
    flavor: "Your teenager 'barely touched' the mailbox. The mailbox is in the living room.",
    effect: { cash: -8_000 },
  },
  {
    id: 'kid-viral', category: 'relationships', title: 'Your Kid Went Viral', requires: 'kids',
    flavor: "Their cereal review has 2M views. You're 'that kid's parent' now. It pays.",
    effect: { cash: 6_000 },
  },
  {
    id: 'college-tours', category: 'relationships', title: 'College Tour Circuit', requires: 'kids',
    flavor: 'Six campuses. Six gift shops. Six $60 hoodies you were powerless against.',
    effect: { cash: -4_000 },
  },
  {
    id: 'daycare-bill', category: 'relationships', title: 'Daycare Invoice', requires: 'kids',
    flavor: 'Daycare costs more than your first car. Monthly. They nap 40% of the time.',
    effect: { cash: -6_000 },
  },
  {
    id: 'tooth-fairy', category: 'relationships', title: 'Tooth Fairy Inflation', requires: 'kids',
    flavor: 'The going rate is $20 a tooth now?? Who negotiated this? The kids have a union?',
    effect: { cash: -1_000 },
  },
  {
    id: 'minivan', category: 'relationships', title: 'The Minivan Acceptance', requires: 'kids',
    flavor: 'You bought the minivan. The sliding door owns you now. It IS convenient.',
    effect: { cash: -6_000 },
  },
  {
    id: 'bail-cousin', category: 'relationships', title: 'Bail Money. Again.',
    flavor: "Your cousin needs bail. It's 'a whole misunderstanding.' It is never a misunderstanding.",
    effect: { cash: -5_000 },
  },
  {
    id: 'family-reunion', category: 'relationships', title: 'You Hosted the Reunion',
    flavor: "Uncle Randy 'forgot his wallet.' Forty ribs vanished. The cornhole set is broken.",
    effect: { cash: -3_000 },
  },

  // =========================================================================
  // MORE INTERNET / NEWS / VICES / CAREER (v2)
  // =========================================================================
  {
    id: 'parasocial-breakup', category: 'internet', title: 'Parasocial Breakup',
    flavor: 'Your favorite streamer apologized (ukulele version). You need a personal day.',
    effect: { skipTurn: true },
  },
  {
    id: 'ai-companion', category: 'internet', title: 'AI Companion Subscription',
    flavor: "You pay $19/mo for an AI that says you're doing great. Honestly? Working.",
    effect: { cash: -1_000 },
  },
  {
    id: 'group-trip', category: 'internet', title: 'The Group Chat Trip',
    flavor: "The spreadsheet has 6 tabs. The villa 'sleeps 12' (it sleeps 6).",
    choice: {
      prompt: 'Are you in?',
      options: [
        { id: 'go', label: 'Book it (-$9k, memories)', effect: { cash: -9_000 } },
        { id: 'flake', label: 'Flake (-$1k deposit, judged forever)', effect: { cash: -1_000 } },
      ],
    },
  },
  {
    id: 'jury-content', category: 'news', title: 'Dismissed From Jury Duty',
    flavor: 'For making content about jury duty. From the jury box. During the trial.',
    effect: { cash: -2_000 },
  },
  {
    id: 'three-day-weekend', category: 'health', title: 'The Perfect Long Weekend',
    flavor: 'Nothing happened for three days. Nothing. It was perfect. You saved money by being still.',
    effect: { cash: 2_000 },
  },
  {
    id: 'candle-retreat', category: 'vices', title: 'The "Wellness Retreat"',
    flavor: 'It was a 4-hour pitch about selling candles to your friends. You bought candles.',
    effect: { cash: -3_000 },
  },
  {
    id: 'dry-wedding', category: 'vices', title: 'A DRY Wedding',
    flavor: 'You Irish-goodbyed to the hotel bar and made nine new best friends.',
    effect: { cash: -2_000 },
  },
  {
    id: 'karaoke-injury', category: 'vices', title: 'Karaoke Injury',
    flavor: "You gave 'Livin' on a Prayer' everything. Including your hamstring.",
    effect: { cash: -3_000 },
  },
  {
    id: 'errand-paralysis', category: 'health', title: 'Errand Paralysis',
    flavor: 'Six errands planned. Zero errands done. One $40 "little lunch" happened.',
    effect: { cash: -1_000 },
  },
  {
    id: 'phone-slowdown', category: 'internet', title: 'Mysterious Phone Slowdown',
    flavor: "Your phone got 'slow' the week the new one dropped. Coincidence, surely.",
    effect: { cash: -5_000 },
  },
  {
    id: 'garage-vintage', category: 'money', title: 'Your Junk Is "Vintage"',
    flavor: "A teen paid real money for your old band tees and called them 'archival.'",
    effect: { cash: 4_000 },
  },
  {
    id: 'title-promotion', category: 'career', title: 'Title-Only Promotion', requires: 'career',
    flavor: 'New title: Senior Lead Principal. New pay: identical. New meetings: eleven.',
    effect: { cash: -1_000 },
  },
  {
    id: 'fantasy-revenge', category: 'career', title: 'Fantasy Football Politics', requires: 'career',
    flavor: "You benched your boss's favorite QB out of spite. The retaliation was swift.",
    effect: { cash: -2_000 },
  },
  {
    id: 'internal-candidate', category: 'career', title: '"We Went Internal"',
    flavor: 'The job was posted for legal reasons. You interviewed four times for legal reasons.',
    effect: { cash: -1_000 },
  },
  {
    id: 'pet-influencer', category: 'internet', title: 'Your Dog Booked a Commercial',
    flavor: 'Regional dog-food spot. He has a manager now. He has better healthcare than you.',
    effect: { cash: 5_000 },
  },
  {
    id: 'couples-costume', category: 'relationships', title: 'Costume Contest Champions', requires: 'married',
    flavor: 'You went as an outlet and a plug. $1,000 and eternal glory.',
    effect: { cash: 1_000 },
  },
  {
    id: 'situationship-tax', category: 'relationships', title: 'The Situationship Tax', requires: 'single',
    flavor: "Six 'not-dates' at $80 each with someone who 'doesn't do labels.'",
    effect: { cash: -2_000 },
  },
  {
    id: 'flaky-soulmate', category: 'relationships', title: 'They Rescheduled. Again.', requires: 'single',
    flavor: "Fourth reschedule. Mercury isn't in retrograde, Taylor. You are.",
    effect: { skipTurn: true },
  },
  {
    id: 'speed-camera', category: 'news', title: 'The New Speed Camera',
    flavor: 'It caught you four times before you knew it existed. The city thanks you for the gazebo.',
    effect: { cash: -2_000 },
  },
  {
    id: 'hot-sauce-hustle', category: 'money', title: 'Small-Batch Hot Sauce',
    flavor: "Your garage hot sauce got picked up by two stores. It's called 'Divorced Dad Heat.'",
    effect: { cash: 5_000 },
  },

  // =========================================================================
  // GEN Z ARC (v3): brainrot, delulu, and financially devastating aesthetics
  // =========================================================================
  {
    id: 'girl-math', category: 'money', title: 'Girl Math',
    flavor: 'It was on sale, you paid cash, and you were going to buy it anyway. Technically you MADE money.',
    effect: { cash: -3_000 },
  },
  {
    id: 'bed-rotting', category: 'health', title: 'Bed Rot Saturday',
    flavor: 'Fourteen horizontal hours of phone. Restorative? Unclear. Complete? Absolutely.',
    effect: { skipTurn: true },
  },
  {
    id: 'doom-spending', category: 'money', title: 'Doom Spending',
    flavor: 'The world is on fire, so you bought a $400 mushroom-shaped lamp. It helps. (It does not help.)',
    effect: { cash: -4_000 },
  },
  {
    id: 'loud-budgeting', category: 'money', title: 'Loud Budgeting',
    flavor: "\"I don't want to spend money on that\" — said out loud, to everyone, with your whole chest. Iconic.",
    effect: { cash: 3_000 },
  },
  {
    id: 'delulu', category: 'internet', title: 'Delulu Is the Solulu',
    flavor: 'You have decided the promotion is already yours. Manifesting hours are 24/7.',
    choice: {
      prompt: 'Stay delulu?',
      options: [
        { id: 'delulu', label: 'Full delulu (manifest it: win $10k or reality checks you for $3k)', effect: { gamble: { win: 10_000, lose: 3_000 } } },
        { id: 'lucid', label: 'Become lucid (nothing happens, boring)', effect: {} },
      ],
    },
  },
  {
    id: 'the-ick', category: 'relationships', title: 'The Ick', requires: 'single',
    flavor: 'They ran after a ping-pong ball. The ick arrived instantly and permanently. Date over.',
    effect: { cash: -1_000 },
  },
  {
    id: 'rizz-course', category: 'internet', title: 'The Rizz Course',
    flavor: "You bought a $200 online rizz masterclass from a man named W_Sigma. It did not work.",
    effect: { cash: -2_000 },
  },
  {
    id: 'brainrot-presentation', category: 'career', title: 'Brainrot Breach', requires: 'career',
    flavor: "Your vocabulary is 40% brainrot now. The quarterly numbers were, quote, 'so Ohio.' HR called a meeting.",
    effect: { salaryPct: -5 },
  },
  {
    id: 'labubu-haul', category: 'money', title: 'The Labubu Pipeline',
    flavor: 'Fourteen blind boxes chasing the secret one. The secret one remains theoretical.',
    effect: { cash: -3_000 },
  },
  {
    id: 'dubai-chocolate', category: 'vices', title: 'Dubai Chocolate Dependency',
    flavor: "$28 a bar. You've had nine. The pistachio has you and it is not letting go.",
    effect: { cash: -1_000 },
  },
  {
    id: 'tumbler-army', category: 'money', title: 'Emotional Support Tumblers',
    flavor: 'Hydration is free. Your twelve limited-edition emotional-support tumblers were not.',
    effect: { cash: -2_000 },
  },
  {
    id: 'matcha-personality', category: 'vices', title: 'Matcha Is a Personality',
    flavor: 'The $9 iced matcha with oat milk is no longer a drink. It is who you are.',
    effect: { cash: -2_000 },
  },
  {
    id: 'run-club', category: 'relationships', title: 'Run Club', requires: 'single',
    flavor: "You joined a run club. It's a dating app with cardio. You got faster AND rejected.",
    effect: { cash: -1_000 },
  },
  {
    id: 'npc-stream', category: 'internet', title: 'NPC Streaming Arc',
    flavor: "'Gang gang. Ice cream so good.' Six hours. Chat tipped generously. Your dignity logged off.",
    effect: { cash: 7_000 },
  },
  {
    id: 'sephora-tween', category: 'relationships', title: 'The Skincare Tween', requires: 'kids',
    flavor: "Your ten-year-old requires a $300 retinol routine for their 'skin barrier.' They have the skin of a ten-year-old.",
    effect: { cash: -3_000 },
  },
  {
    id: 'very-demure', category: 'internet', title: 'Very Demure, Very Mindful',
    flavor: 'Your demure post got licensed for mugs. Very cutesy. Very monetized.',
    effect: { cash: 4_000 },
  },
  {
    id: 'roman-empire', category: 'internet', title: 'The Roman Empire',
    flavor: 'How often do you think about the Roman Empire? (You just did. Again.)',
    effect: {},
  },
  {
    id: 'beige-flags', category: 'relationships', title: 'Beige Flags', requires: 'married',
    flavor: 'Your spouse has eaten the same lunch for 11 years. Not a red flag. Beige. It haunts you beige-ly.',
    effect: { cash: -1_000 },
  },
  {
    id: 'mewing', category: 'health', title: 'The Mewing Year',
    flavor: "You've been mewing for a year. Nobody noticed the jawline. The chiropractor noticed the neck.",
    effect: { cash: -2_000 },
  },
  {
    id: 'looksmaxxing', category: 'health', title: 'Looksmaxxing Starter Pack',
    flavor: 'The forum said you need the full stack: red light mask, mouth tape, bone-smashing (do NOT).',
    choice: {
      prompt: 'Max the looks?',
      options: [
        { id: 'stack', label: 'Buy the full stack (-$6k, confidence roll)', effect: { cash: -6_000, gamble: { win: 8_000, lose: 1_000 } } },
        { id: 'fine', label: 'You look fine actually (+$1k saved)', effect: { cash: 1_000 } },
      ],
    },
  },
  {
    id: 'creatine-shelf', category: 'health', title: 'The Supplement Shelf',
    flavor: "Creatine, colostrum, 'raw pine pollen.' The shelf costs more than rent. You are eternally 'bulking.'",
    effect: { cash: -3_000 },
  },
  {
    id: 'lazy-girl-job', category: 'career', title: 'Lazy Girl Job Acquired', requires: 'career',
    flavor: 'Same pay. Four meetings a year. WFH forever. You tell no one how you found it.',
    effect: { salaryPct: 5 },
  },
  {
    id: 'bare-minimum-monday', category: 'career', title: 'Bare Minimum Monday', requires: 'career',
    flavor: 'You pioneered Bare Minimum Monday. Your boss pioneered Performance Review Tuesday.',
    effect: { salaryPct: -5 },
  },
  {
    id: 'ghost-jobs', category: 'career', title: 'The Ghost Job Market',
    flavor: 'You applied to 200 listings. 180 were fake. The other 20 ghosted you like a bad Hinge date.',
    effect: { cash: -1_000 },
  },
  {
    id: 'side-quest', category: 'internet', title: 'Real-Life Side Quest',
    flavor: 'A stranger gave you $2,000 to help push a piano up a hill, then vanished. Side quest complete.',
    effect: { cash: 2_000 },
  },
  {
    id: 'airdrop-mod', category: 'internet', title: 'Discord Mod Payday',
    flavor: "You modded a crypto Discord 'for exposure.' The airdrop actually hit. Exposure: profitable, once.",
    effect: { cash: 5_000 },
  },
  {
    id: 'prop-bet-brain', category: 'money', title: 'Prop Bet Brain',
    flavor: "You can no longer watch sports. Only 'lines.' The game tonight has a very juicy total.",
    choice: {
      prompt: 'There is no safe option.',
      options: [
        { id: 'over', label: 'Hammer the over', effect: { gamble: { win: 8_000, lose: 6_000 } } },
        { id: 'under', label: 'Hammer the under', effect: { gamble: { win: 8_000, lose: 6_000 } } },
      ],
    },
  },
  {
    id: 'buy-the-dip', category: 'money', title: 'Buy the Dip?',
    flavor: 'It is down 40%. The group chat says "discount." The chart says "knife."',
    choice: {
      prompt: 'Catch it?',
      options: [
        { id: 'buy', label: 'Buy the dip (win $18k / lose $14k)', effect: { gamble: { win: 18_000, lose: 14_000 } } },
        { id: 'knife', label: "It's a falling knife (walk away)", effect: {} },
      ],
    },
  },
  {
    id: 'festival-presale', category: 'vices', title: 'Festival Presale Panic',
    flavor: 'The presale queue has 40,000 people. Your card is already out. Your PTO is already imaginary.',
    choice: {
      prompt: 'Secure the fit pics?',
      options: [
        { id: 'go', label: 'Buy the pass + the outfit (-$5k)', effect: { cash: -5_000 } },
        { id: 'stream', label: 'Watch the livestream (free, FOMO included)', effect: {} },
      ],
    },
  },
  {
    id: 'situationship-anniversary', category: 'relationships', title: 'Six Months of "Hanging Out"', requires: 'single',
    flavor: 'You celebrated the anniversary of your non-relationship. They got you a keychain. You got them a PS5.',
    effect: { cash: -4_000 },
  },
  {
    id: 'thrift-flip', category: 'money', title: 'The Thrift Flip',
    flavor: "A $4 jacket from the bins. A resale kid paid you $300 and whispered 'grail.' You feel powerful.",
    effect: { cash: 3_000 },
  },
  {
    id: 'aesthetic-rotation', category: 'internet', title: 'The Aesthetic Rotated',
    flavor: 'Your entire wardrobe is last season\'s core. The new core drops Tuesday. Participation is mandatory.',
    effect: { cash: -3_000 },
  },
  {
    id: 'finsta-leak', category: 'internet', title: 'The Finsta Leak',
    flavor: 'Your private story leaked into the family group chat. Grandma has questions. HR has more.',
    effect: { cash: -4_000 },
  },
  {
    id: 'dumbphone-era', category: 'health', title: 'Dumbphone Era',
    flavor: 'You bought a flip phone to "touch grass." The peace is real. So is missing everything.',
    choice: {
      prompt: 'Log off for real?',
      options: [
        { id: 'detox', label: 'Full detox (+$3k saved, lose a turn — you missed the plans)', effect: { cash: 3_000, skipTurn: true } },
        { id: 'nvm', label: 'Never mind (redownload everything)', effect: {} },
      ],
    },
  },
  {
    id: 'doordash-across-street', category: 'vices', title: 'The $31 Burrito',
    flavor: 'You DoorDashed one burrito from the restaurant physically across the street. Fees included shame.',
    effect: { cash: -1_000 },
  },
  {
    id: 'cabana-decision', category: 'vices', title: 'Vegas Pool Party',
    flavor: 'The bouncer says the cabana is "the move." The bouncer works on commission.',
    choice: {
      prompt: 'How do we suffer?',
      options: [
        { id: 'cabana', label: 'Get the cabana (-$8k, main character)', effect: { cash: -8_000 } },
        { id: 'sunburn', label: 'Free sun, free burn (-$1k in aloe)', effect: { cash: -1_000 } },
      ],
    },
  },
  {
    id: 'custom-crocs', category: 'money', title: 'One-of-One Crocs',
    flavor: "You commissioned $250 custom Crocs. 'Business casual,' you said, to security, at the office.",
    effect: { cash: -1_000 },
  },
  {
    id: 'sleep-divorce', category: 'relationships', title: 'Sleep Divorce', requires: 'married',
    flavor: 'Separate rooms, better sleep, thriving marriage, confused in-laws. Science wins again.',
    effect: { cash: -2_000 },
  },
  {
    id: 'micro-retirement', category: 'career', title: 'Micro-Retirement', requires: 'career',
    flavor: "You quit for three months to 'live.' It was great. The résumé gap is now load-bearing.",
    choice: {
      prompt: 'Take the gap?',
      options: [
        { id: 'retire', label: 'Micro-retire (-$8k, lose a turn, no regrets)', effect: { cash: -8_000, skipTurn: true } },
        { id: 'grind', label: 'Keep grinding (-$1k in stress snacks)', effect: { cash: -1_000 } },
      ],
    },
  },
  {
    id: 'stanley-resale', category: 'money', title: 'The Restock Flip',
    flavor: 'You camped a tumbler restock and flipped four. The girlies paid triple. No notes.',
    effect: { cash: 3_000 },
  },
  {
    id: 'gamified-savings', category: 'money', title: 'Savings App Streak',
    flavor: 'You kept a 90-day no-spend streak alive like it was a Tamagotchi. It paid out. Barely. Still counts.',
    effect: { cash: 2_000 },
  },
  {
    id: 'group-order-martyr', category: 'vices', title: 'The Group Order Martyr',
    flavor: "You 'covered it for points.' The points: 240. The order: $186. The Venmos: never coming.",
    effect: { cash: -2_000 },
  },

  // =========================================================================
  // ACTUAL CRISIS (v3.2): disasters that scale with your smugness
  // =========================================================================
  {
    id: 'market-meltdown', category: 'money', title: 'Everything Is Down',
    flavor: 'Stocks: down. Crypto: down. The "safe stuff": somehow the most down. Your advisor stopped answering.',
    effect: { cashPct: -35 },
  },
  {
    id: 'ponzi-book-club', category: 'money', title: 'The Book Club Fund',
    flavor: "Guaranteed 2% weekly returns. You told your whole book club. Marcia's husband is 'handling it.' Marcia's husband is in Aruba.",
    effect: { cashPct: -40 },
  },
  {
    id: 'irs-double-audit', category: 'news', title: 'The Auditor Brought a Friend',
    flavor: 'The IRS auditor arrived with a second auditor. They high-fived in your kitchen.',
    effect: { cashPct: -25 },
  },
  {
    id: 'lifestyle-creep', category: 'money', title: 'Lifestyle Creep',
    flavor: 'You have a guy for everything now. The guys have guys. Everyone bills hourly. You cannot go back.',
    effect: { cashPct: -20 },
  },
  {
    id: 'midlife-lambo', category: 'vices', title: 'The Lambo Moment',
    flavor: 'The dealer let you sit in it. The dealer knew exactly what he was doing.',
    choice: {
      prompt: 'This is the crisis the game is named after.',
      options: [
        { id: 'buy', label: 'Buy the Lambo (lose 30% of your cash)', effect: { cashPct: -30 } },
        { id: 'therapy', label: 'Drive home in the Corolla, book therapy (-$5k)', effect: { cash: -5_000 } },
      ],
    },
  },
  {
    id: 'yacht-week', category: 'vices', title: 'Yacht Week Invite',
    flavor: "Someone from high school 'chartered a boat.' The buy-in is a mortgage payment. The photos would be incredible.",
    choice: {
      prompt: 'Croatia is calling.',
      options: [
        { id: 'board', label: 'Board the yacht (lose 25% of your cash)', effect: { cashPct: -25 } },
        { id: 'flake', label: 'Flake at the marina (-$2k deposit)', effect: { cash: -2_000 } },
      ],
    },
  },
  {
    id: 'startup-dream', category: 'career', title: 'The Startup Dream',
    flavor: "You have an idea. It's 'Uber for naps.' Your cofounder is your most unhinged friend.",
    choice: {
      prompt: 'Chase it?',
      options: [
        { id: 'found', label: 'Quit and found it (win $80k or lose $50k)', effect: { gamble: { win: 80_000, lose: 50_000 } } },
        { id: 'idea-guy', label: 'Stay an idea guy (-$1k in domain names)', effect: { cash: -1_000 } },
      ],
    },
  },
  {
    id: 'second-lottery-mortgage', category: 'money', title: 'Double or Nothing Brain',
    flavor: 'A voice says: "you could win it all back plus more." The voice has never once been right.',
    choice: {
      prompt: 'Listen to the voice?',
      options: [
        { id: 'double', label: 'Listen (win 50% / lose 50% of your cash)', effect: { gamblePct: { win: 50, lose: 50 } } },
        { id: 'ignore', label: 'Ignore the voice (growth)', effect: {} },
      ],
    },
  },

  // =========================================================================
  // TABLE STAKES (v3.2): players paying players
  // =========================================================================
  {
    id: 'superbowl-squares', category: 'money', title: 'Super Bowl Squares Winner',
    flavor: 'You had 0-0 and did not watch a single down. Everyone at this table owes you.',
    effect: { collectFromEach: 3_000 },
  },
  {
    id: 'pyramid-launch', category: 'money', title: 'You Got In Early',
    flavor: "It's not a pyramid scheme, it's a 'reverse funnel.' Everyone you know is now your downline.",
    effect: { collectFromEach: 2_000 },
  },
  {
    id: 'trip-treasurer', category: 'money', title: 'The Group Trip Treasurer',
    flavor: "You held the vacation fund. There were 'administrative fees.' The books are sealed.",
    effect: { collectFromEach: 2_000 },
  },
  {
    id: 'shots-for-table', category: 'vices', title: 'SHOTS FOR EVERYBODY',
    flavor: 'You stood on a chair and pointed at each of them individually. There is no walking this back.',
    effect: { payToEach: 1_500 },
  },
  {
    id: 'intervention', category: 'vices', title: 'The Intervention (Yours)',
    flavor: 'They staged it for you. There were poster boards. You owe everyone gas money and an apology.',
    effect: { payToEach: 1_000 },
  },
  {
    id: 'gala-pledge', category: 'news', title: 'Charity Gala Pledge',
    flavor: 'The paddle went up. Your hand was on the paddle. Everyone saw. Everyone gets a cut of your shame.',
    effect: { payToEach: 2_000 },
  },
  {
    id: 'backflip-bet', category: 'vices', title: 'The Backflip Bet',
    flavor: 'You told the entire table you could still do a backflip. The table has money on this.',
    choice: {
      prompt: 'Prove it?',
      options: [
        { id: 'flip', label: 'Attempt the flip (win $9k / lose $9k + dignity)', effect: { gamble: { win: 9_000, lose: 9_000 } } },
        { id: 'decline', label: 'Back down (pay everyone the coward tax)', effect: { payToEach: 500 } },
      ],
    },
  },
  {
    id: 'estate-sale-frenzy', category: 'money', title: 'You Ran the Estate Sale',
    flavor: "You sold everyone at this table something 'vintage' from a stranger's garage. No refunds.",
    effect: { collectFromEach: 1_500 },
  },

  // =========================================================================
  // TAX SEASON (v3.2): death and these
  // =========================================================================
  {
    id: 'diy-taxes', category: 'money', title: 'You Did Your Own Taxes',
    flavor: "How hard could it be? (It could be extremely hard. There's a whole profession.)",
    choice: {
      prompt: 'File it yourself?',
      options: [
        { id: 'diy', label: 'Free-file at 11:58 PM April 15 (refund $8k or audit -$12k)', effect: { gamble: { win: 8_000, lose: 12_000 } } },
        { id: 'pro', label: 'Pay the accountant (-$3k, sleep soundly)', effect: { cash: -3_000 } },
      ],
    },
  },
  {
    id: '1099-surprise', category: 'money', title: 'The 1099 Surprise',
    flavor: 'Your side hustle sent a 1099. Nobody withheld anything. NOBODY withheld ANYTHING.',
    effect: { cash: -8_000 },
  },
  {
    id: 'capital-gains', category: 'money', title: 'Capital Gains Realization',
    flavor: 'The gains were realized. Then the tax bill was realized. Then you realized several things.',
    effect: { cashPct: -10 },
  },

  // =========================================================================
  // MINI-GAMES (v4): your actual hands decide your fate
  // =========================================================================
  {
    id: 'phone-toilet', category: 'internet', title: 'Phone Over the Toilet',
    flavor: "It's happening in slow motion. Your entire digital life, arcing toward the bowl.",
    minigame: {
      game: 'reflex',
      instructions: 'Tap the very instant it says CATCH!',
      tiers: {
        great: { cash: 2_000 },
        ok: { cash: -2_000 },
        fail: { cash: -8_000 },
      },
    },
  },
  {
    id: 'cat-vase', category: 'health', title: 'The Cat vs. The Heirloom Vase',
    flavor: 'The cat is making direct eye contact. Its paw is already in motion. It has chosen violence.',
    minigame: {
      game: 'reflex',
      instructions: 'Tap the instant it says CATCH!',
      tiers: {
        great: { cash: 3_000 },
        ok: { cash: -1_000 },
        fail: { cash: -5_000 },
      },
    },
  },
  {
    id: 'bjorksnas', category: 'health', title: 'The BJÖRKSNÄS Wardrobe',
    flavor: "211 steps. One Allen key. A bag of screws labeled 'extra?? maybe'.",
    minigame: {
      game: 'mash',
      instructions: 'MASH to assemble it before your will to live runs out!',
      tiers: {
        great: { cash: 3_000 },
        ok: {},
        fail: { cash: -4_000 },
      },
    },
  },
  {
    id: 'blizzard-driveway', category: 'health', title: 'The Driveway After the Blizzard',
    flavor: 'Fourteen inches overnight. The plow guy "has a list." Your shovel awaits.',
    minigame: {
      game: 'mash',
      instructions: 'MASH to shovel before the school run!',
      tiers: {
        great: { cash: 2_500 },
        ok: {},
        fail: { cash: -3_000, skipTurn: true },
      },
    },
  },
  {
    id: 'street-parking', category: 'money', title: 'Street Parking Only',
    flavor: "One spot left. It's between a Cybertruck and a police cruiser. Everyone at the café is watching.",
    minigame: {
      game: 'timing',
      instructions: 'Tap to stop the marker in the green zone!',
      tiers: {
        great: { cash: 2_000 },
        ok: { cash: -1_000 },
        fail: { cash: -6_000 },
      },
    },
  },
  {
    id: 'espresso-ritual', category: 'vices', title: 'The Home Espresso Ritual',
    flavor: 'A $1,400 machine. Nineteen variables. God — and the group chat — is watching.',
    minigame: {
      game: 'timing',
      instructions: 'Tap to stop the marker in the green — dial in the shot!',
      tiers: {
        great: { cash: 1_000 },
        ok: {},
        fail: { cash: -2_000 },
      },
    },
  },
]

const byId = new Map(CARDS.map((c) => [c.id, c]))

export function cardById(id: string): EventCard {
  const c = byId.get(id)
  if (!c) throw new Error(`No such card: ${id}`)
  return c
}
