import mongoose from "mongoose";

const statusLogSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "pending",
        "called",
        "on-the-way",
        "visited",
        "not-ready",
        "farm-didnt-pick",
        "submitted",
      ],
      required: true,
    },
    changedAt: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
  },
  { _id: false }
);

const fieldTicketSchema = new mongoose.Schema(
  {
    field_guyId: { type: String, required: true },
    farmerId: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "called",
        "on-the-way",
        "visited",
        "not-ready",
        "farm-didnt-pick",
        "submitted",
      ],
      default: "pending",
      required: true,
    },
    statusLogs: {
      type: [statusLogSchema],
      default: function () {
        return [{ status: this.status || "pending", changedAt: new Date() }];
      },
    },
    farmername: { type: String, required: true },
    farmernumber: { type: String, required: true },
    village: { type: String, required: true },
    district: { type: String, required: true },
    taluk: { type: String },
    reportedNHD: { type: String, required: true },
    cropName: { type: String, required: true },
    cropId: { type: String, required: true },
    priority: {
      type: String,
      enum: ["ASAP", "LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
      required: true,
    },
    dueDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to update statusLogs if status is changed
fieldTicketSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    this.statusLogs.push({
      status: this.status,
      changedAt: new Date(),
    });
  }
  next();
});

const FieldTicket = mongoose.model("FieldTicket", fieldTicketSchema);
export default FieldTicket;
