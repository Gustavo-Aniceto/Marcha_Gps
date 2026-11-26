-- Radares oficiais (CET, DER, ANTT): só o importador chama; lê cada formato; atualiza e desativa;
-- radar do OSM em cima de um oficial sai; arquivo quebrado não apaga o mapa.
begin;

select E'\xef\xbb\xbfCÓDIGO LOCAL,ATIVAÇÃO,DESATIVAÇÃO,NÚMERO DE SÉRIE,DESCRIÇÃO DO LOCAL,LATITUDE,LONGITUDE,FAIXAS,TIPO,METROLÓGICO,VELOCIDADE,FISCALIZA FAIXA AZUL,CAPTURA,REDUTOR,ENQUADRAMENTO\r\n'
    || E'100,2024-11-19,,0881/2023,"AV SANTA INES B/C, OPOSTO NR 3200",-23.4700000,-46.6300000,2,FIXO,SIM,50 km/h,Não,T,N,V\r\n'
    || E'2684,2015-03-13,2024-01-31,9907205,AL DOS TUPINIQUINS X AV DOS BANDEIRANTES,-23.616192,-46.663464,3,FIXO,NÃO,40 km/h,Não,T,N,CPD; R\r\n'
    || E'117,2025-01-10,,0695/2023,R GALVAO BUENO B/C NR 18,-23.5600000,-46.6350000,1,FIXO,SIM,40 km/h,Não,T,N,F; R; V; Z\r\n'
    || E'118,2025-01-10,,0696/2023,R SO RODIZIO,-23.5610000,-46.6360000,1,FIXO,NÃO,40 km/h,Não,T,N,R\r\n' as cet \gset

select '<?xml version="1.0" encoding="utf-8"?><NewDataSet>'
    || '<radares><RAD_CODIGO>1</RAD_CODIGO><KmInicial>27.350</KmInicial><Orientacao>Oeste</Orientacao><Latitude>-23.468125</Latitude><Longitude>-46.421274</Longitude><Municipio>Guarulhos</Municipio><TipoRadar>Controlador</TipoRadar><Rodovia>SP 070</Rodovia><Denominacao>Ayrton Senna</Denominacao><rad_vel_regul>100/080 km/h</rad_vel_regul><rad_ativo>Ativo</rad_ativo></radares>'
    || '<radares><RAD_CODIGO>2</RAD_CODIGO><KmInicial>1.8</KmInicial><Municipio>Guarulhos</Municipio><TipoRadar>Portátil</TipoRadar><Rodovia>SP 019</Rodovia><rad_vel_regul>080/080 km/h</rad_vel_regul><rad_ativo>Ativo</rad_ativo></radares>'
    || '<radares><RAD_CODIGO>3</RAD_CODIGO><Latitude>-21.876356</Latitude><Longitude>-48.095308</Longitude><Municipio>Araraquara</Municipio><TipoRadar>Controlador</TipoRadar><rad_vel_regul>080/080 km/h</rad_vel_regul><rad_ativo>Ativo</rad_ativo></radares>'
    || '<radares><RAD_CODIGO>4</RAD_CODIGO><Latitude>-23,4593</Latitude><Longitude>-46,34461</Longitude><Municipio>Itaquaquecetuba</Municipio><TipoRadar>Redutor</TipoRadar><Rodovia>SP 066</Rodovia><rad_vel_regul>060/060 km/h</rad_vel_regul><rad_ativo>Ativo</rad_ativo></radares>'
    || '</NewDataSet>' as der \gset

select E'concessionaria;ano_do_pnv_snv;tipo_de_radar;rodovia;uf;km_m;Municipio;tipo_de_pista;sentido;situacao;data_da_inativacao;latitude;longitude;velocidade_leve;velocidade_pesado\n'
    || E'RIOSP;2000;Controlador;BR-116;SP;225,88;Guarulhos;Principal;Decrescente;Ativo;;-23,45;-46,50;90;80\n'
    || E'AUTOPISTA FLUMINENSE;2019;Controlador;BR-101;RJ;58,805;Campos;Principal;Decrescente;Ativo;;-21,713412;-41,308561;60;60\n' as antt \gset

-- radar do OSM no mesmo lugar do da CET (vai sair) e um longe (fica)
insert into public.reports (kind, lat, lon, city_id, source, source_ref, base_risk, speed_limit)
values ('radar', -23.47005, -46.63, 'sao_paulo', 'osm', 'node/900', 0, null),
       ('radar', -23.60, -46.70, 'sao_paulo', 'osm', 'node/901', 0, 60);

set local role authenticated;
select t.login('user_2qualquer0000000000000000');
select t.throws($$ select public.import_official_radars('cet', 'x') $$, 'permission denied');
reset role;

set local role importador;
select public.import_official_radars('cet', :'cet') as r1 \gset
select public.import_official_radars('der', :'der') as r2 \gset
select public.import_official_radars('antt', :'antt') as r3 \gset
reset role;

select t.ok((:'r1'::jsonb ->> 'novos')::int = 2, 'CET: 2 ativos que fiscalizam velocidade');
select t.ok((select speed_limit || ':' || status || ':' || label from public.reports where source_ref = 'cet/100')
            = '50:confirmed:AV SANTA INES B/C, OPOSTO NR 3200', 'CET: velocidade, confirmado e endereço com vírgula');
select t.ok(not exists (select 1 from public.reports where source_ref in ('cet/2684', 'cet/118')), 'CET: desativado e sem velocidade ficam de fora');
select t.ok((:'r2'::jsonb ->> 'novos')::int = 2, 'DER: só os com posição, das 3 cidades');
select t.ok((select speed_limit || ':' || city_id from public.reports where source_ref = 'der/1') = '100:guarulhos', 'DER: velocidade de carro');
select t.ok((select city_id from public.reports where source_ref = 'der/4') = 'itaquaquecetuba', 'DER: vírgula decimal e lombada eletrônica');
select t.ok((:'r3'::jsonb ->> 'novos')::int = 1, 'ANTT: só SP e as 3 cidades');
select t.ok((select speed_limit from public.reports where source = 'antt' and source_ref like 'antt/BR-116%') = 90, 'ANTT: velocidade leve');
select t.ok((select status from public.reports where source_ref = 'node/900') = 'expired', 'radar do OSM em cima do oficial sai');
select t.ok((select status from public.reports where source_ref = 'node/901') = 'unconfirmed', 'radar do OSM longe fica');
select t.ok(not exists (select 1 from public.points_ledger), 'importar não dá ponto');
select t.ok((select city_id from public.reports where source_ref = 'cet/100') = 'sao_paulo', 'CET: cidade pelo nome, mesmo na divisa');

-- semana seguinte: o 117 foi desativado na fonte
select replace(:'cet', E'117,2025-01-10,,', E'117,2025-01-10,2026-11-20,') as cet2 \gset
set local role importador;
select public.import_official_radars('cet', :'cet2') as r4 \gset
reset role;
select t.ok((select status from public.reports where source_ref = 'cet/117') = 'expired', 'desativado na fonte sai do mapa');
select t.ok((:'r4'::jsonb ->> 'atualizados')::int = 1, 'o que continua só atualiza');
select t.ok((select count(*) from public.reports where source_ref = 'cet/100') = 1, 'não duplica');

-- arquivo vazio/quebrado não apaga nada
select t.throws($$ select public.import_official_radars('cet', 'lixo') $$, 'lista_suspeita');
select t.throws($$ select public.import_official_radars('xyz', 'a') $$, 'fonte_invalida');
select t.ok((select parse_speed('080/080 km/h')) = 80 and parse_speed('50 km/h') = 50 and parse_speed('') is null
            and parse_speed('5') is null, 'lê a velocidade');

rollback;
