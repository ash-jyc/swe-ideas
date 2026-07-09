import type { Career, House } from './types'

export const CAREERS: Career[] = [
  // ---- Straight-to-work pool -------------------------------------------
  { id: 'bartender', title: 'Bartender', salary: 35_000, college: false, flavor: "You know everyone's secrets and everyone's tab." },
  { id: 'rideshare', title: 'Rideshare Driver', salary: 30_000, college: false, flavor: '4.92 stars. The missing .08 haunts you.' },
  { id: 'influencer', title: 'Influencer', salary: 45_000, college: false, flavor: "Your job is posting. Your parents tell people you're 'in marketing.'" },
  { id: 'content-creator', title: 'Content Creator', salary: 50_000, college: false, flavor: "Subscription tiers. Don't ask what's behind the paywall." },
  { id: 'crypto-bro', title: 'Crypto Bro', salary: 50_000, college: false, flavor: "Salary paid in a coin you can't pronounce." },
  { id: 'mlm', title: 'MLM Boss Babe', salary: 30_000, college: false, flavor: "It's not a pyramid, it's a triangle of opportunity. Hey hun!" },
  { id: 'podcaster', title: 'Podcast Host', salary: 40_000, college: false, flavor: 'Two mics, zero listeners, infinite confidence.' },
  { id: 'tattoo', title: 'Tattoo Artist', salary: 55_000, college: false, flavor: "Permanent art, temporary boyfriends' names." },
  { id: 'realtor', title: 'Real Estate Agent', salary: 60_000, college: false, flavor: 'Your face is on a bus bench. This is power.' },
  { id: 'plumber', title: 'Plumber', salary: 75_000, college: false, flavor: "AI can't fix a toilet. You win." },
  { id: 'streamer', title: 'Twitch Streamer', salary: 45_000, college: false, flavor: "'Chat, should I quit my day job?' Chat said yes. Chat was 40 people." },
  { id: 'sneaker-reseller', title: 'Sneaker Reseller', salary: 40_000, college: false, flavor: 'You camp drops. Your closet is a stock exchange with worse liquidity.' },

  // ---- College pool ------------------------------------------------------
  { id: 'tech', title: 'Tech Worker', salary: 105_000, college: true, flavor: "Free snacks, unlimited PTO you're too scared to use." },
  { id: 'doctor', title: 'Doctor', salary: 120_000, college: true, flavor: 'Ten years of school to argue with insurance companies.' },
  { id: 'lawyer', title: 'Lawyer', salary: 110_000, college: true, flavor: 'You bill in six-minute increments. Even for this.' },
  { id: 'prompt-eng', title: 'AI Prompt Engineer', salary: 95_000, college: true, flavor: 'You whisper to robots. Somehow it pays.' },
  { id: 'therapist', title: 'Therapist', salary: 80_000, college: true, flavor: 'Everyone trauma-dumps on you. At least now they pay for it.' },
  { id: 'accountant', title: 'Accountant', salary: 85_000, college: true, flavor: 'You alone know where the money went.' },
  { id: 'pharmacist', title: 'Pharmacist', salary: 95_000, college: true, flavor: 'Standing for twelve hours, explaining insurance for eleven.' },
  { id: 'data-sci', title: 'Data Scientist', salary: 100_000, college: true, flavor: "It's spreadsheets. Beautiful, six-figure spreadsheets." },
  { id: 'engineer', title: 'Civil Engineer', salary: 90_000, college: true, flavor: 'You point at bridges and say "I did that." Nobody believes you.' },
  { id: 'professor', title: 'Adjunct Professor', salary: 70_000, college: true, flavor: 'Three campuses, no office, a tote bag full of ungraded essays.' },
]

export const HOUSES: House[] = [
  { id: 'van', title: 'Van Down by the River', price: 10_000, resale: 14_000, flavor: "It's not homelessness, it's #VanLife." },
  { id: 'tiny', title: 'Tiny House', price: 40_000, resale: 50_000, flavor: '300 square feet of Pinterest smugness.' },
  { id: 'shoebox', title: 'Studio "Shoebox" Apartment', price: 60_000, resale: 72_000, flavor: 'The oven heats the whole home. Because it can reach the whole home.' },
  { id: 'bunker', title: 'Off-Grid Doomsday Bunker', price: 80_000, resale: 95_000, flavor: 'Canned beans included. Sunlight not.' },
  { id: 'fixer', title: 'Charming "Fixer-Upper" Victorian', price: 100_000, resale: 150_000, flavor: 'The inspector just laughed and laughed.' },
  { id: 'starter', title: 'Suburban Starter Home', price: 120_000, resale: 140_000, flavor: 'Gray laminate floors. A doorbell that spies on you.' },
  { id: 'condo', title: 'Condo with HOA Drama', price: 150_000, resale: 160_000, flavor: 'Karen from unit 4B has opinions about your doormat.' },
  { id: 'mcmansion', title: 'McMansion', price: 250_000, resale: 285_000, flavor: 'Five bathrooms, zero bookshelves.' },
]

export function careerById(id: string): Career {
  const c = CAREERS.find((c) => c.id === id)
  if (!c) throw new Error(`No such career: ${id}`)
  return c
}

export function houseById(id: string): House {
  const h = HOUSES.find((h) => h.id === id)
  if (!h) throw new Error(`No such house: ${id}`)
  return h
}
