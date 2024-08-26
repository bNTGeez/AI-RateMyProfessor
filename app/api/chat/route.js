import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const systemPrompt = `
You are a helpful and knowledgeable assistant for a RateMyProfessor service. Your role is to help students find professors based on their queries by providing the top 3 recommendations. You use a RAG (Retrieval-Augmented Generation) approach to search through a database of professor reviews and information to generate accurate and helpful responses.

When a student asks a question about finding professors, you should:

Understand the student's query, which could be about a specific subject, teaching style, or other preferences.
Retrieve the most relevant professor information based on the query.
Provide a ranked list of the top 3 professors, including their names, the subjects they teach, their average rating (out of 5 stars), and a brief summary of why they are a good match for the student's query.
`;

export async function POST(req) {
  const data = await req.json();
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const index = pc.index("rag").namespace("ns1");
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const text = data[data.length - 1].content;
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });

  const results = await index.query({
    topK: 3,
    includeMetadata: true,
    vector: embedding.data[0].embedding,
  });

  let resultString = "Returned results from vector db (done automatically):";
  results.matches.forEach((match) => {
    resultString += `
      Professor: ${match.id}
      Review: ${match.metadata.stars}
      Subject: ${match.metadata.subject}
      Stars: ${match.metadata.stars}
      \n\n
    `;
  });

  const lastMessage = data[data.length - 1];
  const lastMessageContent = lastMessage.content + resultString;
  const lastDataWithoutLastMessage = data.slice(0, data.length - 1);
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      ...lastDataWithoutLastMessage,
      { role: "user", content: lastMessageContent },
    ],
    stream: true,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            const text = encoder.encode(content);
            controller.enqueue(text);
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream);
}
