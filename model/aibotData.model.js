import mongoose from "mongoose";

const aibotDataSchema = new mongoose.Schema(
  {
    number: { type: String },
    name: { type: String },
    crop: { type: String  },
    tag: { type: String },
    next_harvest_date: { type:String},
    no_of_trees: { type: Number},
  },
  
);

const aibotData = mongoose.model("aibotData", aibotDataSchema);

export default aibotData;