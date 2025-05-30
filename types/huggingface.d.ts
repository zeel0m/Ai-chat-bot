declare module '@huggingface/inference' {
  export class HfInference {
    constructor(apiKey?: string);
    textGeneration(params: {
      model: string;
      inputs: string;
      parameters?: {
        max_new_tokens?: number;
        temperature?: number;
        top_p?: number;
        repetition_penalty?: number;
      };
    }): Promise<{ generated_text: string }>;
  }
} 