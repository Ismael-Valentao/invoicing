// Call the dataTables jQuery plugin
$(document).ready(function() {
  $('#dataTable').DataTable({
    "language": {
        "lengthMenu": "Mostrar _MENU_ Registos",
        "zeroRecords": "Nenhum registo encontrado",
        "info": "Mostrando página _PAGE_ de _PAGES_",
        "infoEmpty": "Nenhum registo disponível",
        "infoFiltered": "(filtrado de _MAX_ total de registos)",
        "search": "Pesquisar:",
        "paginate": {
            "first": "Primeiro",
            "last": "Último",
            "next": "Próximo",
            "previous": "Anterior"
        }
    }
  });
});
