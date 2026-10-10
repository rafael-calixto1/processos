// Regras de finalização de OS. Uma só fonte: o servidor valida com elas e o bootstrap as entrega ao app.
export const REGRAS_FECHAMENTO = Object.freeze({
  descricao_min_caracteres: 11, // a descrição precisa ter mais de 10 caracteres
  descricao_max_caracteres: 5000,
  fotos_min: 1,
  fotos_max: 30,
  foto_max_bytes: 8 * 1024 * 1024,
  participantes_max: 20,
  retirados_max: 50,
});
