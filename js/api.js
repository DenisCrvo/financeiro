/**
 * Camada de acesso remoto: única responsabilidade é buscar o CSV publicado.
 * Não conhece formato interno dos dados nem regras de negócio.
 */
import { CONFIG } from "./config.js";

/**
 * Busca o CSV publicado da planilha via Fetch API.
 * Adiciona um parâmetro de cache-busting para evitar que o navegador
 * ou o Google sirvam uma versão em cache ao clicar em "Atualizar Dados".
 * @returns {Promise<string>} conteúdo bruto do CSV.
 * @throws {Error} quando a requisição falha ou o servidor responde com erro.
 */
export async function fetchCsv() {
  const url = `${CONFIG.CSV_URL}&_=${Date.now()}`;

  let response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (networkError) {
    throw new Error(
      "Não foi possível conectar à planilha. Verifique sua conexão com a internet."
    );
  }

  if (!response.ok) {
    throw new Error(
      `A planilha respondeu com erro (HTTP ${response.status}). Verifique se ela ainda está publicada.`
    );
  }

  return response.text();
}
