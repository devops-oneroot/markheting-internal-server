import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    
  },
  created_By: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
   
  },
  number: {
    type: String,
 
  },
  name: {
    type: String,
  },
  task: {
    type: String,
  
  },
  taluk: {
    type: String,
    
  },
  district: {
    type: String,
    
  },
  pincode: {
    type: String,
    
  },
  tag: {
    type: String,
   
  },
  downloaded: {
    type: Boolean,
    default: false,
    
  },
  consent: {
    type: Boolean,
    default: false,
    
  },
  consent_date: {
    type: Date,
    default: Date.now,
    
  },
  village: {
    type: String,
    
  },
  age: {
    type: Number,
    min: 0,
    max: 120,
    
  },
  farmer_category: {
    type: String,
 
    
    
  },

  assigned_to: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      
    },
  ],
  priority: {
    type: String,
    enum: ["low", "medium", "high", "asap"],
    default: "medium",
 
  },
  cropName: {
    type: String,
    enum: ["Tender Coconut", "Dry Coconut", "Turmeric", "Banana", "NAP"],
    default: "NAP",
    
  },
  remarks: [
    {
      remark: { type: String, required: true },
      time: { type: Date, default: Date.now },
      by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent",
        
      },
    },
  ],
  dueDate: {
    type: Date,
  
  },
  status: {
    type: String,
    enum: ["Opened", "Waiting For", "Closed"],
    default: "Opened",
   
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Ticket = mongoose.model("Ticket", ticketSchema);

export default Ticket;
