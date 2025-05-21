import bcrypt from "bcrypt";
import Agent from "../model/agent.model.js"; // adjust the path as needed
import jwt from "jsonwebtoken";
import User from "../model/user.model.js";

export const createAgent = async (req, res) => {
  try {
    const { name, password, phoneNumber } = req.body;
    if (!name || !password || !phoneNumber) {
      return res
        .status(400)
        .json({ message: "Name, password, and phone number are required." });
    }

    const existing = await Agent.findOne({ phoneNumber });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An agent with this phone number already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const agent = await Agent.create({
      name,
      phoneNumber,
      passwordHash,
    });

    const { passwordHash: _, ...agentData } = agent.toObject();

    return res
      .status(201)
      .json({ message: "Agent created successfully", agent: agentData });
  } catch (error) {
    console.error("Error creating agent:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { userId, password } = req.body;

    // 1. Validate request body
    if (!userId || !password) {
      return res
        .status(400)
        .json({ message: "userId and password are required." });
    }

    // 2. Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Update the agent's passwordHash
    const result = await Agent.updateOne(
      { _id: userId },
      { $set: { passwordHash: hashedPassword } }
    );

    // 4. Check if any document was modified
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Agent not found." });
    }

    // 5. Success
    return res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const loginAgent = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res
        .status(400)
        .json({ message: "phoneNumber and password are required." });
    }

    const agent = await Agent.findOne({ phoneNumber });
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }

    const isMatch = await bcrypt.compare(password, agent.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Sign a JWT with agent ID and role
    const payload = { id: agent._id, role: agent.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "14d",
    });

    const { passwordHash, ...agentData } = agent.toObject();

    return res.status(200).json({
      message: "Login successful.",
      token,
      agent: agentData,
    });
  } catch (error) {
    console.error("loginAgent error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getAgentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Agent id is required." });
    }
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }
    const { passwordHash, ...agentData } = agent.toObject();
    return res.status(200).json({ agent: agentData });
  } catch (error) {
    console.error("getAgentById error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const verifyToken = (req, res) => {
  try {
    const { token } = req.params;
    // Verify and decode
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = {
      id: payload.id,
      role: payload.role,
    };

    return res.status(200).json(user);
  } catch (err) {
    console.error("verifyToken error:", err);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

// export const addUserNotes = async (req, res) => {
//   const agentId = "682b0414f0a29e17c1a519e7"; // hardcoded for now
//   const { note, userId } = req.body;

//   console.log(note, userId);

//   if (!note) {
//     return res.status(400).json({ message: "No note provided" });
//   }

//   try {
//     const user = await User.findById("68189dd8af8983adccb1fdc8");

//     console.log(user);

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     if (!Array.isArray(user.note)) {
//       user.note = [];
//     }

//     user.note.push({
//       note,
//       by: agentId,
//       createdAt: new Date(),
//     });

//     await user.save();

//     return res.status(200).json({
//       success: true,
//       message: "Note added successfully",
//       data: user.note,
//     });
//   } catch (error) {
//     console.error("Internal server error", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };
