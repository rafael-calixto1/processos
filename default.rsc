/interface bridge
add name=LAN protocol-mode=none
/ip hotspot user profile
set [ find default=yes ] on-login="# Captura o nome e o telefone do usuario\r\
    \n:global nome [get [find] name]  # Captura o nome do usuario\r\
    \n:global telefone [get [find] number]  # Captura o telefone do usuario\r\
    \n\r\
    \n# Registrar no log do MikroTik\r\
    \n:log info (\"Novo cadastro no Hotspot - Nome: \" . \$nome . \" - Telefone: \" . \$telefone)\r\
    \n\r\
    \n# (Opcional) Cria o usuario no Hotspot com telefone como nome de usuario e senha\r\
    \n/ip hotspot user add name=\$telefone password=\$telefone comment=\$nome\r\
    \n"
/system logging action
add disk-file-count=1 disk-file-name=logins-hotspot disk-lines-per-file=50 name=hotspot target=disk
/ip firewall connection tracking
set tcp-established-timeout=5m
/ip address
add address=192.168.50.1/23 interface=LAN network=192.168.50.0
/ip hotspot profile
set [ find default=yes ] login-by=cookie,http-chap,http-pap
/ip service
set ftp disabled=yes
set ssh disabled=yes
set telnet disabled=yes
set www disabled=yes
set api disabled=yes
set api-ssl disabled=yes
/system clock
set time-zone-name=America/Fortaleza
/system logging
set 1 disabled=yes
add action=hotspot topics=hotspot,info,debug
/system scheduler
add interval=5s name=CADASTRA_USUARIO_HOTSPOT on-event="# Inicializa a variavel para controle\r\
    \n:global fileContent [/file get [find name=logins-hotspot.0.txt] contents]\r\
    \n\r\
    \n# Verifica se o arquivo tem conteudo\r\
    \n:if ([:len \$fileContent] = 0) do={\r\
    \n    :log info \"Arquivo vazio. Nenhum dado para processar.\"\r\
    \n    :return\r\
    \n}\r\
    \n\r\
    \n# Enquanto houver dados no arquivo, processa\r\
    \n:while ([:len \$fileContent] > 0) do={\r\
    \n    # Encontra a posicao do comentario da linha\r\
    \n    :global beginString ([:find \$fileContent \"!==\"] + 3)\r\
    \n\r\
    \n    # Se nao encontrar o padrao '!==', limpa o arquivo e sai\r\
    \n    :if (\$beginString = 3) do={\r\
    \n        /file set [find name=logins-hotspot.0.txt] contents=\"\"\r\
    \n        :log error \"Formato invalido ou final de arquivo. Limpando arquivo.\"\r\
    \n        :return\r\
    \n    }\r\
    \n\r\
    \n    # Encontra a posicao do final da linha\r\
    \n    :global endString [:find \$fileContent \"==!\"]\r\
    \n\r\
    \n    # Extrai os dados do arquivo e atualiza a variavel 'fileContent'\r\
    \n    :global userToAdd [:pick \$fileContent \$beginString \$endString]\r\
    \n    :global fileContent [:pick \$fileContent (\$endString + 3) [:len \$fileContent]]\r\
    \n\r\
    \n    # Extraindo nome e telefone (assumindo que os dados estao separados por virgula)\r\
    \n    :global name [:pick \$userToAdd 0 [:find \$userToAdd \",\"]]\r\
    \n    :global phone [:pick \$userToAdd ([:find \$userToAdd \",\"] + 1) [:len \$userToAdd]]\r\
    \n\r\
    \n    # Verifica se o usuario ja existe no Hotspot\r\
    \n    :global userExists [/ip hotspot user find name=\$phone]\r\
    \n\r\
    \n    # Se o usuario ja existir, registra no log e pula a cria\E7\E3o\r\
    \n    :if ([:len \$userExists] > 0) do={\r\
    \n        :log info message=(\"Usuario com o telefone \" . \$phone . \" ja existe. Pulando criacao.\")\r\
    \n    } else={\r\
    \n        # Se os dados estiverem completos, cria o usuario no Hotspot\r\
    \n        :if ([:len \$name] > 0 && [:len \$phone] > 0) do={\r\
    \n            # Senha ser\E1 igual ao numero completo do telefone\r\
    \n            :global password \$phone\r\
    \n            \r\
    \n            # Cria o usuario no Hotspot\r\
    \n            /ip hotspot user add name=\$phone password=\$password comment=\$name\r\
    \n\r\
    \n            # Registra a criacao do usuario no log\r\
    \n            :log info message=(\"Usu\E1rio criado - Nome: \" . \$name . \" - Telefone: \" . \$phone)\r\
    \n            /log warning message=(\"Nome: \" . \$name . \" - Telefone: \" . \$phone)\r\
    \n        } else={\r\
    \n            :log error message=(\"Dados incompletos para o cadastro - Nome: \" . \$name . \" - Telefone: \" . \$phone)\r\
    \n        }\r\
    \n    }\r\
    \n\r\
    \n    # Delay para nao sobrecarregar o sistema\r\
    \n    delay 500ms\r\
    \n}\r\
    \n" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon start-time=startup
add interval=5m name=RELATORIO on-event=GeraRelatorio policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon start-time=startup
/system script
add dont-require-permissions=no name=GeraRelatorio owner=admin policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source=":local fileName \"hotspot-leads.csv\"\r\
    \n:local filePath \"flash/\$fileName\"\r\
    \n:local csvContent \"Nome,Telefone\\r\\n\"\r\
    \n\r\
    \n# Percorre os usu\E1rios do hotspot\r\
    \n:foreach user in=[/ip hotspot user find] do={\r\
    \n\r\
    \n    :local telefone [/ip hotspot user get \$user name]\r\
    \n    :local nome [/ip hotspot user get \$user comment]\r\
    \n\r\
    \n    :if (\$telefone != \"default-trial\" && [:len \$nome] > 0) do={\r\
    \n        :local linha (\"\$nome,\$telefone\\r\\n\")\r\
    \n        :set csvContent (\$csvContent . \$linha)\r\
    \n    }\r\
    \n}\r\
    \n\r\
    \n# Remove o arquivo antigo, se existir\r\
    \n:if ([:len [/file find name=\$fileName]] > 0) do={\r\
    \n    /file remove [find name=\$fileName]\r\
    \n}\r\
    \n\r\
    \n# Cria o novo arquivo com os dados\r\
    \n/file add name=\$fileName contents=\$csvContent\r\
    \n\r\
    \n:log info \"\? Leads exportados para \$filePath\"\r\
    \n:put \"\? Arquivo criado com sucesso!\"\r\
    \n"
add dont-require-permissions=no name=LimpaUsuarios owner=admin policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source=\
    ":foreach user in=[/ip hotspot user find where !default] do={\r\
    \n    /ip hotspot user remove \$user\r\
    \n}\r\
    \n:put \"\? Usu\E1rios do Hotspot removidos (exceto default).\"\r\
    \n"

