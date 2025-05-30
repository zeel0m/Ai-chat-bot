import { NextResponse } from 'next/server';
import { TravelServices } from '../services/travel-apis';

// Free API key for demonstration - replace with your own from openrouter.ai
const OPENROUTER_API_KEY = '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';
const travelServices = new TravelServices();

// Store conversations in memory (in a production app, use a database)
const conversations: Record<string, { 
  messages: Array<{ role: string; content: string }>;
  travelInfo?: {
    destination?: string;
    source?: string;
    dates?: { start: string; end: string };
    budget?: number;
  };
}> = {};

const SYSTEM_PROMPT = `You are a smart travel planning assistant with access to real-time data. Follow these rules:

1. For non-travel queries, respond ONLY with: "I'm here to help only with travel planning."

2. For travel queries, gather information in this order:
   a) Basic Trip Details:
      - Source location (city or airport code)
      - Destination (city or airport code)
      - Travel dates
      - Number of travelers
      - Budget (specify currency)

   b) Flight Preferences:
      - Preferred airlines (if any)
      - Preferred flight times
      - Direct flights or layovers acceptable
      - Cabin class preference

   c) If user has a specific flight:
      - Ask for flight number for real-time tracking
      - Offer to monitor flight status
      - Provide airport information for both departure and arrival

3. After collecting information, I can provide:
   - Weather forecast for destination
   - Flight options and pricing
   - Real-time flight tracking
   - Airport details and schedules
   - Airline information
   - Hotel suggestions
   - Local attractions
   - Currency exchange rates

4. For airport-related queries:
   - Search airports by city/name
   - Show departure/arrival schedules
   - Provide terminal information
   - Display available facilities

5. Keep responses concise and focused on travel planning.
6. Remember previous information for context-aware responses.
7. Proactively offer relevant information based on user's travel plans.`;

async function enrichResponseWithData(userMessage: string, travelInfo: any) {
  if (!travelInfo.destination) return null;

  try {
    const data: any = {};

    // Get detailed weather if we have destination
    if (travelInfo.destination) {
      data.currentWeather = await travelServices.getDetailedWeather(travelInfo.destination);
      
      // If we have travel dates, get historical weather for the same dates from previous year
      if (travelInfo.dates?.start && travelInfo.dates?.end) {
        const lastYear = new Date().getFullYear() - 1;
        const historicalStart = travelInfo.dates.start.replace(/\d{4}/, lastYear);
        const historicalEnd = travelInfo.dates.end.replace(/\d{4}/, lastYear);
        data.historicalWeather = await travelServices.getHistoricalWeather(
          travelInfo.destination,
          historicalStart,
          historicalEnd
        );
      }
    }

    // Get flights if we have source and destination
    if (travelInfo.source && travelInfo.destination && travelInfo.dates?.start) {
      data.flights = await travelServices.getFlights(
        travelInfo.source,
        travelInfo.destination,
        travelInfo.dates.start
      );
    }

    // Get hotels if we have destination and dates
    if (travelInfo.destination && travelInfo.dates?.start && travelInfo.dates?.end) {
      data.hotels = await travelServices.getHotels(
        travelInfo.destination,
        travelInfo.dates.start,
        travelInfo.dates.end
      );
    }

    // Get attractions
    if (travelInfo.destination) {
      data.places = await travelServices.getPlaces(travelInfo.destination);
    }

    return data;
  } catch (error) {
    console.error('Error fetching travel data:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { message, sessionId = 'default' } = await request.json();
    console.log('Received message:', message);

    // Initialize conversation if it doesn't exist
    if (!conversations[sessionId]) {
      conversations[sessionId] = {
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          }
        ],
        travelInfo: {}
      };
    }

    // Add user message to conversation history
    conversations[sessionId].messages.push({
      role: 'user',
      content: message
    });

    // Get real-time travel data if available
    const enrichedData = await enrichResponseWithData(message, conversations[sessionId].travelInfo);
    if (enrichedData) {
      conversations[sessionId].messages.push({
        role: 'system',
        content: `Here's the latest travel data: ${JSON.stringify(enrichedData)}`
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Travel Planner'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct',
        messages: conversations[sessionId].messages,
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;
    
    // Add AI response to conversation history
    conversations[sessionId].messages.push({
      role: 'assistant',
      content: aiMessage
    });

    // Keep conversation history to a reasonable size
    if (conversations[sessionId].messages.length > 20) {
      conversations[sessionId].messages = [
        conversations[sessionId].messages[0],
        ...conversations[sessionId].messages.slice(-10)
      ];
    }

    // Update travel info based on the conversation
    updateTravelInfo(conversations[sessionId], message);

    console.log('AI response:', aiMessage);
    return NextResponse.json({ message: aiMessage });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function updateTravelInfo(conversation: any, message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Extract destination (after "to" or "in")
  const toMatch = lowerMessage.match(/(?:to|in)\s+([a-zA-Z\s]+)(?:\s|$)/);
  if (toMatch) {
    conversation.travelInfo.destination = toMatch[1].trim();
  }

  // Extract source (after "from")
  const fromMatch = lowerMessage.match(/from\s+([a-zA-Z\s]+)(?:\s|$)/);
  if (fromMatch) {
    conversation.travelInfo.source = fromMatch[1].trim();
  }

  // Extract dates (simple date format detection)
  const dateMatch = lowerMessage.match(/(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?)/gi);
  if (dateMatch && dateMatch.length >= 2) {
    conversation.travelInfo.dates = {
      start: dateMatch[0],
      end: dateMatch[1]
    };
  }

  // Extract budget (number followed by currency)
  const budgetMatch = lowerMessage.match(/(\d+(?:,\d+)?)\s*(?:dollars|usd|inr|eur|gbp|₹|€|£|\$)/i);
  if (budgetMatch) {
    conversation.travelInfo.budget = parseInt(budgetMatch[1].replace(',', ''));
  }
}

// Fix the linter errors by moving the example code inside an async function
async function handleFlightQueries(airportCode: string, airlineCode: string) {
  const airports = await travelServices.searchAirports(airportCode);
  const airlineInfo = await travelServices.getAirlineInfo(airlineCode);
  const departures = await travelServices.getAirportSchedule(airportCode, 'departure');
  const arrivals = await travelServices.getAirportSchedule(airportCode, 'arrival');
  return { airports, airlineInfo, departures, arrivals };
} 