import axios from 'axios';

interface WeatherData {
  current: {
    temperature: number;
    feels_like: number;
    humidity: number;
    conditions: string;
    wind_speed: number;
    uv_index: number;
    visibility: number;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    conditions: string;
    precipitation_chance: number;
  }>;
  daily: Array<{
    date: string;
    temperature: {
      min: number;
      max: number;
    };
    conditions: string;
    sunrise: string;
    sunset: string;
    precipitation_chance: number;
    uv_index: number;
  }>;
  alerts?: Array<{
    event: string;
    description: string;
    start: string;
    end: string;
  }>;
}

interface HistoricalWeather {
  date: string;
  temperature: {
    average: number;
    min: number;
    max: number;
  };
  humidity: number;
  conditions: string;
  precipitation: number;
}

interface FlightData {
  price: number;
  airline: string;
  departure: string;
  arrival: string;
  duration: string;
}

interface FlightTrackingData {
  flightNumber: string;
  status: string;
  departure: {
    airport: string;
    terminal: string;
    gate: string;
    scheduledTime: string;
    actualTime?: string;
    delay?: number;
  };
  arrival: {
    airport: string;
    terminal: string;
    gate: string;
    scheduledTime: string;
    actualTime?: string;
    delay?: number;
  };
}

interface HotelData {
  name: string;
  price: number;
  rating: number;
  location: string;
  amenities: string[];
}

interface PlaceData {
  name: string;
  rating: number;
  address: string;
  type: string;
  photos?: string[];
}

interface ExchangeRate {
  rate: number;
  fromCurrency: string;
  toCurrency: string;
}

interface AirportData {
  iata: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

interface AirlineData {
  name: string;
  iata: string;
  fleet_size?: number;
  country: string;
  active: boolean;
}

interface FlightSchedule {
  airline: string;
  flightNumber: string;
  departure: {
    airport: string;
    scheduledTime: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    scheduledTime: string;
    terminal?: string;
  };
  frequency: string[];  // Days of operation
}

export class TravelServices {
  private readonly WEATHER_API_KEY = process.env.WEATHER_API_KEY;
  private readonly AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
  private readonly GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  private readonly EXCHANGE_API_KEY = process.env.EXCHANGE_API_KEY;
  private readonly AVIATION_STACK_API_KEY = process.env.AVIATION_STACK_API_KEY || 'YOUR_FREE_API_KEY';

  async getDetailedWeather(city: string, lat?: number, lon?: number): Promise<WeatherData> {
    try {
      // First get coordinates if not provided
      if (!lat || !lon) {
        const geoResponse = await axios.get(
          `http://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${this.WEATHER_API_KEY}`
        );
        if (geoResponse.data.length === 0) {
          throw new Error('Location not found');
        }
        lat = geoResponse.data[0].lat;
        lon = geoResponse.data[0].lon;
      }

      // Get detailed weather data using OneCall API
      const response = await axios.get(
        `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely&appid=${this.WEATHER_API_KEY}&units=metric`
      );

      return {
        current: {
          temperature: response.data.current.temp,
          feels_like: response.data.current.feels_like,
          humidity: response.data.current.humidity,
          conditions: response.data.current.weather[0].description,
          wind_speed: response.data.current.wind_speed,
          uv_index: response.data.current.uvi,
          visibility: response.data.current.visibility
        },
        hourly: response.data.hourly.slice(0, 24).map((hour: any) => ({
          time: new Date(hour.dt * 1000).toISOString(),
          temperature: hour.temp,
          conditions: hour.weather[0].description,
          precipitation_chance: hour.pop * 100
        })),
        daily: response.data.daily.map((day: any) => ({
          date: new Date(day.dt * 1000).toISOString(),
          temperature: {
            min: day.temp.min,
            max: day.temp.max
          },
          conditions: day.weather[0].description,
          sunrise: new Date(day.sunrise * 1000).toISOString(),
          sunset: new Date(day.sunset * 1000).toISOString(),
          precipitation_chance: day.pop * 100,
          uv_index: day.uvi
        })),
        alerts: response.data.alerts?.map((alert: any) => ({
          event: alert.event,
          description: alert.description,
          start: new Date(alert.start * 1000).toISOString(),
          end: new Date(alert.end * 1000).toISOString()
        }))
      };
    } catch (error) {
      console.error('Weather API Error:', error);
      throw new Error('Unable to fetch detailed weather data');
    }
  }

  async getHistoricalWeather(city: string, startDate: string, endDate: string): Promise<HistoricalWeather[]> {
    try {
      // First get coordinates
      const geoResponse = await axios.get(
        `http://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${this.WEATHER_API_KEY}`
      );
      if (geoResponse.data.length === 0) {
        throw new Error('Location not found');
      }
      const { lat, lon } = geoResponse.data[0];

      // Convert dates to Unix timestamps
      const start = Math.floor(new Date(startDate).getTime() / 1000);
      const end = Math.floor(new Date(endDate).getTime() / 1000);
      
      // Get historical data for each day
      const days: HistoricalWeather[] = [];
      for (let dt = start; dt <= end; dt += 86400) {
        const response = await axios.get(
          `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${dt}&appid=${this.WEATHER_API_KEY}&units=metric`
        );

        days.push({
          date: new Date(dt * 1000).toISOString(),
          temperature: {
            average: response.data.data[0].temp,
            min: response.data.data[0].temp_min,
            max: response.data.data[0].temp_max
          },
          humidity: response.data.data[0].humidity,
          conditions: response.data.data[0].weather[0].description,
          precipitation: response.data.data[0].rain?.['1h'] || 0
        });
      }

      return days;
    } catch (error) {
      console.error('Historical Weather API Error:', error);
      throw new Error('Unable to fetch historical weather data');
    }
  }

  async getFlights(from: string, to: string, date: string): Promise<FlightData[]> {
    try {
      const response = await axios.get(
        `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${from}&destinationLocationCode=${to}&departureDate=${date}&adults=1`,
        {
          headers: {
            Authorization: `Bearer ${this.AMADEUS_API_KEY}`
          }
        }
      );
      return response.data.data.map((flight: any) => ({
        price: flight.price.total,
        airline: flight.validatingAirlineCodes[0],
        departure: flight.itineraries[0].segments[0].departure.at,
        arrival: flight.itineraries[0].segments[0].arrival.at,
        duration: flight.itineraries[0].duration
      }));
    } catch (error) {
      console.error('Flight API Error:', error);
      throw new Error('Unable to fetch flight data');
    }
  }

  async getHotels(city: string, checkIn: string, checkOut: string): Promise<HotelData[]> {
    try {
      const response = await axios.get(
        `https://test.api.amadeus.com/v2/shopping/hotel-offers?cityCode=${city}&checkInDate=${checkIn}&checkOutDate=${checkOut}`,
        {
          headers: {
            Authorization: `Bearer ${this.AMADEUS_API_KEY}`
          }
        }
      );
      return response.data.data.map((hotel: any) => ({
        name: hotel.hotel.name,
        price: hotel.offers[0].price.total,
        rating: hotel.hotel.rating,
        location: hotel.hotel.address.lines.join(', '),
        amenities: hotel.hotel.amenities || []
      }));
    } catch (error) {
      console.error('Hotel API Error:', error);
      throw new Error('Unable to fetch hotel data');
    }
  }

  async getPlaces(city: string): Promise<PlaceData[]> {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=attractions+in+${city}&key=${this.GOOGLE_PLACES_API_KEY}`
      );
      return response.data.results.map((place: any) => ({
        name: place.name,
        rating: place.rating,
        address: place.formatted_address,
        type: place.types[0],
        photos: place.photos?.map((photo: any) => 
          `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${this.GOOGLE_PLACES_API_KEY}`
        )
      }));
    } catch (error) {
      console.error('Places API Error:', error);
      throw new Error('Unable to fetch places data');
    }
  }

  async getExchangeRate(from: string, to: string): Promise<ExchangeRate> {
    try {
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${from}`
      );
      return {
        rate: response.data.rates[to],
        fromCurrency: from,
        toCurrency: to
      };
    } catch (error) {
      console.error('Exchange Rate API Error:', error);
      throw new Error('Unable to fetch exchange rate data');
    }
  }

  async trackFlight(flightNumber: string): Promise<FlightTrackingData> {
    try {
      const response = await axios.get(
        `http://api.aviationstack.com/v1/flights?access_key=${this.AVIATION_STACK_API_KEY}&flight_iata=${flightNumber}`
      );

      const flight = response.data.data[0];
      if (!flight) {
        throw new Error('Flight not found');
      }

      return {
        flightNumber: flight.flight.iata,
        status: flight.flight_status,
        departure: {
          airport: flight.departure.airport,
          terminal: flight.departure.terminal || 'N/A',
          gate: flight.departure.gate || 'N/A',
          scheduledTime: flight.departure.scheduled,
          actualTime: flight.departure.actual,
          delay: flight.departure.delay
        },
        arrival: {
          airport: flight.arrival.airport,
          terminal: flight.arrival.terminal || 'N/A',
          gate: flight.arrival.gate || 'N/A',
          scheduledTime: flight.arrival.scheduled,
          actualTime: flight.arrival.actual,
          delay: flight.arrival.delay
        }
      };
    } catch (error) {
      console.error('Flight Tracking API Error:', error);
      throw new Error('Unable to track flight');
    }
  }

  async searchFlights(from: string, to: string, date: string): Promise<FlightData[]> {
    try {
      // First try Amadeus API
      try {
        return await this.getFlights(from, to, date);
      } catch (error) {
        console.log('Amadeus API failed, falling back to Aviation Stack');
      }

      // Fallback to Aviation Stack for real-time flight data
      const response = await axios.get(
        `http://api.aviationstack.com/v1/flights?access_key=${this.AVIATION_STACK_API_KEY}&dep_iata=${from}&arr_iata=${to}&flight_date=${date}`
      );

      return response.data.data.map((flight: any) => ({
        price: null, // Aviation Stack doesn't provide pricing
        airline: flight.airline.name,
        departure: flight.departure.scheduled,
        arrival: flight.arrival.scheduled,
        duration: this.calculateDuration(
          new Date(flight.departure.scheduled),
          new Date(flight.arrival.scheduled)
        )
      }));
    } catch (error) {
      console.error('Flight Search API Error:', error);
      throw new Error('Unable to search flights');
    }
  }

  private calculateDuration(departure: Date, arrival: Date): string {
    const diff = arrival.getTime() - departure.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  async searchAirports(query: string): Promise<AirportData[]> {
    try {
      const response = await axios.get(
        `http://api.aviationstack.com/v1/airports?access_key=${this.AVIATION_STACK_API_KEY}&search=${query}`
      );

      return response.data.data.map((airport: any) => ({
        iata: airport.iata_code,
        name: airport.airport_name,
        city: airport.city_name,
        country: airport.country_name,
        timezone: airport.timezone,
        latitude: airport.latitude,
        longitude: airport.longitude
      }));
    } catch (error) {
      console.error('Airport Search API Error:', error);
      throw new Error('Unable to search airports');
    }
  }

  async getAirlineInfo(airlineCode: string): Promise<AirlineData> {
    try {
      const response = await axios.get(
        `http://api.aviationstack.com/v1/airlines?access_key=${this.AVIATION_STACK_API_KEY}&airline_code=${airlineCode}`
      );

      const airline = response.data.data[0];
      if (!airline) {
        throw new Error('Airline not found');
      }

      return {
        name: airline.airline_name,
        iata: airline.iata_code,
        fleet_size: airline.fleet_size,
        country: airline.country_name,
        active: airline.status === 'active'
      };
    } catch (error) {
      console.error('Airline Info API Error:', error);
      throw new Error('Unable to fetch airline information');
    }
  }

  async getAirportSchedule(airportCode: string, type: 'departure' | 'arrival' = 'departure'): Promise<FlightSchedule[]> {
    try {
      const response = await axios.get(
        `http://api.aviationstack.com/v1/flights?access_key=${this.AVIATION_STACK_API_KEY}&${type === 'departure' ? 'dep' : 'arr'}_iata=${airportCode}`
      );

      return response.data.data.map((flight: any) => ({
        airline: flight.airline.name,
        flightNumber: flight.flight.iata,
        departure: {
          airport: flight.departure.airport,
          scheduledTime: flight.departure.scheduled,
          terminal: flight.departure.terminal
        },
        arrival: {
          airport: flight.arrival.airport,
          scheduledTime: flight.arrival.scheduled,
          terminal: flight.arrival.terminal
        },
        frequency: this.parseFlightFrequency(flight.flight.schedule)
      }));
    } catch (error) {
      console.error('Airport Schedule API Error:', error);
      throw new Error('Unable to fetch airport schedule');
    }
  }

  private parseFlightFrequency(schedule: any): string[] {
    if (!schedule) return [];
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days.filter(day => schedule[day] === true);
  }
} 