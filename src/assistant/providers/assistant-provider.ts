import { AssistantResponseDto } from '../dto';

/** Um provedor de modelo (Claude, Gemini) que responde usando a ferramenta convert_currency. */
export interface AssistantProvider {
  readonly name: string;
  /** false quando falta a chave da API deste provedor */
  readonly available: boolean;
  ask(question: string): Promise<AssistantResponseDto>;
}
