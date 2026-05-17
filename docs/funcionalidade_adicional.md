# Funcionalidade Adicional — Histórico de Reservas por Usuário

Foi implementada uma funcionalidade de histórico de reservas por usuário, sejam elas confirmadas ou canceladas.

O padrão de projeto Proxy foi utilizado para controlar o acesso ao histórico de reservas.

Foi criada uma classe chamada `HistoricoReservasProxy`, responsável por:

- acessar o histórico real
- armazenar consultas em cache
- evitar buscas repetidas no repositório