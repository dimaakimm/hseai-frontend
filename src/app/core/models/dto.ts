export interface ClassifierRequest {
  inputs: Array<{
    name: 'question';
    datatype: 'str';
    data: string;
    shape: 0;
  }>;
  output_fields: Array<
    | { name: 'question'; datatype: 'str' }
    | { name: 'predicted_category'; datatype: 'str' }
    | { name: 'confidence'; datatype: 'FP64' }
  >;
}

export interface ClassifierResponse {
  outputs: {
    question: string;
    predicted_category: string;
    confidence: number; // 0..1
  };
}

export interface AiRequestInput {
  name: 'question' | 'question_filters' | 'user_filters' | 'campus_filters' | 'chat_history';
  datatype: 'str';
  data: string;
  shape: 0;
}

export interface AiRequest {
  inputs: AiRequestInput[];
}

export interface AiResponse {
  outputs: {
    answer: string;
  };
}
