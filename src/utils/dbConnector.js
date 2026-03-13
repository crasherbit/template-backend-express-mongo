import mongoose from 'mongoose';

export const initDb = () => {
  const { MONGODB_CONNSTRING } = process.env;
  return mongoose.connect(MONGODB_CONNSTRING);
};
