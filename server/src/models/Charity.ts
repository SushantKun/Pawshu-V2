import mongoose from 'mongoose';

interface ImageObject {
  public_id: string;
  url: string;
}

const charitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  },
  goal: {
    type: Number,
    required: true
  },
  raised: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export const Charity = mongoose.model('Charity', charitySchema);

// Initial charities data
export const initialCharities = [
  {
    name: "Nepal Animal Shelter",
    description: "Supporting stray animals with food, shelter, and medical care. Your donation helps us provide essential care for abandoned pets.",
    image: {
      public_id: "charity_placeholder",
      url: "https://placehold.co/300x300"
    },
    goal: 50000,
    raised: 0 // 0% progress
  },
  {
    name: "Street Dog Welfare",
    description: "Providing vaccinations and medical treatment for street dogs. Help us create a healthier environment for street animals.",
    image: {
      public_id: "charity_placeholder",
      url: "https://placehold.co/300x300"
    },
    goal: 25000,
    raised: 0 // 0% progress
  },
  {
    name: "Cat Shelter",
    description: "Meoww!",
    image: {
      public_id: "charity_placeholder",
      url: "https://placehold.co/300x300"
    },
    goal: 20000,
    raised: 0 // 0% progress
  }
]; 