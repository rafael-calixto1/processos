// Os ícones carregam a fonte de forma assíncrona e isso enche a saída dos testes de avisos de `act()`; nos testes basta que existam.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Icone = ({ name }: { name: string }) => React.createElement('Icone', { name });
  return { Ionicons: Icone };
});
