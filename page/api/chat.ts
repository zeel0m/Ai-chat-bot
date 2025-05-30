import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let chatHistory: ChatCompletionMessageParam[] = [];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const userMessage = req.body.message;

  chatHistory.push({ role: "user", content: userMessage });

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a travel planner AI assistant." },
      ...chatHistory,
    ],
  });

  const aiMessage = completion.choices[0].message?.content || "";
  chatHistory.push({ role: "assistant", content: aiMessage });

  res.status(200).json({ message: aiMessage });
}
