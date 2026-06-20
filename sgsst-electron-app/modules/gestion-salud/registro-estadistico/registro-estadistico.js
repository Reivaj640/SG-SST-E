/* ==========================================================
   K+AIR Sección 3.2.3 — Registro y Análisis Estadístico
   JavaScript Logic
   ========================================================== */

(function kairSection323() {
  'use strict';

  /* ==========================================================
     SAMPLE DATA — 78 registros de referencia
     [anio, fecha, mes, ciudad, evento, nombreCompleto, sexo,
     identificacion, cargo, tipoEvento, severidad, estado,
     mortal, parteAfectada, mecanismo, lugar, agente, tipoLesion, descripcion]
     ========================================================== */
  const SAMPLE_DATA = [
    [2016,'2016-02-23','febrero','Puerto colombia','At','Amanda Molina Molina','Mujer','CC 22510033','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Caida de objetos','Otras áreas comunes','Herramientas, implementos o utensilios','Golpe o contusion o aplastamiento','LA EMPLEADA SE ENCONTRABA LIMPIANDO UN TECHO CON UNA ESCOBA'],
    [2016,'2016-03-22','marzo','Barranquilla','At','Monica Cardenas Pedroza','Mujer','CC 1046812955','Auxiliar','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Caida de objetos','Almacenes o depositos','Herramientas, implementos o utensilios','Golpe o contusion o aplastamiento','La trabajadora se encontraba en el bar sacando hielo de la nevera'],
    [2016,'2016-03-26','marzo','Barranquilla','At','Zanith Suarez Perez','Mujer','CC 22583181','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Pies','Caida de objetos','Otras áreas comunes','Ambiente de trabajo (incluye superficies','Herida','La trabajadora se encontraba realizando el aseo y tropieza'],
    [2016,'2016-04-15','abril','Barranquilla','At','Alexis Vega Abello','Hombre','CC 72231147','Ayudante de cocina','Deportivo','Alta inmediata','Cerrado','NO','Manos','Pisadas,choques o golpes .','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Golpe o contusion o aplastamiento','El trabajador participaba en campeonato de futbol interno'],
    [2016,'2016-05-09','mayo','Barranquilla','At','Paola Maldonado Coronell','Mujer','CC 1044390535','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Miembros superiores','Sobreesfuerzo, esfuerzo excesivo o falso','Oficinas','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Rodando archivador sintio dolor en hombro izquierdo'],
    [2016,'2016-05-28','mayo','Barranquilla','At','Yurany Ospino Castillo','Mujer','CC 1043604639','Cocinero','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Pisadas,choques o golpes .','Escaleras','Ambiente de trabajo (incluye superficies','Luxacion','Bajando escaleras pisa mal y se cae golpeandose el pie izquierdo'],
    [2016,'2016-06-21','junio','Barranquilla','At','Jose De la cruz Morante','Hombre','CC 1088333361','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Ojo','Otro','Oficinas','Ambiente de trabajo (incluye superficies','Herida','Limpiando ventanas con destornillador se resbala y se causa herida'],
    [2016,'2016-07-04','julio','Barranquilla','At','Erica Cervantes Buendia','Mujer','CC 22584921','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Miembros superiores','Caida de objetos','Otras áreas comunes','Aparatos','Herida','Lavando utensilios se ocasiona herida con cuchillo'],
    [2016,'2016-07-15','julio','Barranquilla','At','Francisco Barrios Cabrera','Hombre','CC 72282718','Aux de bodega','Deportivo','Alta inmediata','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Otras áreas comunes','Ambiente de trabajo (incluye superficies','Golpe o contusion o aplastamiento','Jugando futbol interno companero le golpea rodilla derecha'],
    [2016,'2016-08-03','agosto','Barranquilla','At','Yesid Fierro Gomez','Hombre','CC 8774378','Empacador','Propios del trabajo','Leve','Cerrado','NO','Miembros superiores','Caida de objetos','Areas recreativas o deportivas','Herramientas, implementos o utensilios','Luxacion','Bajando turbina de 15kg se resbala siente dolor en hombro'],
    [2016,'2016-09-26','septiembre','Barranquilla','At','Yusef Amaya Molina','Hombre','CC 1044391162','Ayudante de mantenimiento','Deportivo','Alta inmediata','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Golpe o contusion o aplastamiento','Jugando futbol companero le pega en rodilla izquierda'],
    [2016,'2016-10-05','octubre','Barranquilla','At','Francisco Barrios Cabrera','Hombre','CC 72282718','Aux de bodega','Propios del trabajo','Alta inmediata','Cerrado','NO','Miembros inferiores','Caida de objetos','Almacenes o depositos','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Recibiendo mercancia liston se parte le caen tubos en rodilla'],
    [2016,'2016-10-30','octubre','Barranquilla','At','Luz Nova Hernandez','Mujer','CC 44191674','Auxiliar','Propios del trabajo','Alta inmediata','Cerrado','NO','Pies','Pisadas,choques o golpes .','Escaleras','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Bajando escaleras se resbala se dobla pie izquierdo'],
    [2016,'2016-12-13','diciembre','Barranquilla','At','Maryeli Herrera Andrade','Mujer','CC 1048209377','Ayudante de cocina','Propios del trabajo','Muy leve','Cerrado','NO','Ojo','Exposicion ocontacto con sustancias noci','Otro','Herramientas, implementos o utensilios','Quemadura','Limpiando plancha caliente pisca de aceite cae en ojo'],
    [2016,'2016-12-15','diciembre','Barranquilla','At','Emilton Rua Ospino','Hombre','CC 72124042','Auxiliar','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Otro','Otro','Herramientas, implementos o utensilios','Herida','Porcionando lomos cuchillo se resbala se corta dedo'],
    [2016,'2016-12-17','diciembre','Barranquilla','At','Jair rafael De la hoz Ahumada','Hombre','CC 72210550','Auxiliar de cocina','Propios del trabajo','Severo','Cerrado','NO','Manos','Otro','Almacenes o depositos','Ambiente de trabajo (incluye superficies','Herida','Manipulando maquina tajadora se resbala cuchilla lesiona dedo 5'],
    [2016,'2016-12-19','diciembre','Barranquilla','At','Yefri Romero Vasquez','Hombre','CC 1043667569','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Miembros inferiores','Caida de objetos','Otro','Aparatos','Golpe o contusion o aplastamiento','Lavando caldero de 15kg se resbala golpea rodilla'],
    [2017,'2017-05-12','mayo','Barranquilla','At','Jamircen Chala Villanueva','Hombre','CC 1140831251','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Miembros inferiores','Caida de personas','Otras áreas comunes','Ambiente de trabajo (incluye superficies','Golpe o contusion o aplastamiento','Sirviendo pedido se resbala traumatismo rodilla izquierda'],
    [2017,'2017-06-02','junio','Barranquilla','At','Yefri Romero Vasquez','Hombre','CC 1043667569','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Exposicion o contacto con temperatura ex','Otro','Herramientas, implementos o utensilios','Quemadura','Lavando utensilios cogio olla caliente sin aviso'],
    [2017,'2017-07-05','julio','Barranquilla','At','Ivan Perez Portillo','Hombre','CC 8767528','Cocinero','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Exposicion o contacto con temperatura ex','Otras áreas comunes','Otros agentes no clasificados','Herida','Prendiendo horno con escape de gas sale llama'],
    [2017,'2017-07-07','julio','Barranquilla','At','Duvan Arteta Molina','Hombre','CC 1043932130','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Caida de objetos','Otras áreas comunes','Herramientas, implementos o utensilios','Herida','Limpiando con machete se enreda en rama se corta pierna'],
    [2017,'2017-08-02','agosto','Barranquilla','At','Zamit Solano Mejia','Hombre','CC 1048205563','Auxiliar de primeros auxilios','Deportivo','Leve','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Jugando futbol pisa mal cae lesionando rodilla izquierda'],
    [2017,'2017-08-03','agosto','Barranquilla','At','Alex Carpintero Ahumanda','Hombre','CC 8487831','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Manos','Pisadas,choques o golpes .','Otras áreas comunes','Herramientas, implementos o utensilios','Herida','Cortando matas con machete se resbala herida dedo'],
    [2017,'2017-10-27','octubre','Barranquilla','At','Jhonny Arrieta Llanos','Hombre','CC 8699499','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Otro','Otro','Otros agentes no clasificados','Golpe o contusion o aplastamiento','No vio puerta cerrada de vidrio se golpea'],
    [2017,'2017-12-14','diciembre','Barranquilla','At','Alvaro Martinez Chamorro','Hombre','CC 1044392702','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Ojo','Otro','Otras áreas comunes','Otros agentes no clasificados','Otro','Reciclando basura agua contaminada cae en ojo izquierdo'],
    [2017,'2017-11-30','noviembre','Barranquilla','Ep','Rafael enrique Diaz Navarro','Hombre','CC 8779253','Supernumerario','','Ep','Cerrado','NO','Sin Definir','Sin Definir','Sin Definir','Sin Definir','Sin Definir','Enfermedad laboral registrada'],
    [2017,'2017-06-09','junio','Barranquilla','Ep','Dalcy Olivares Lascarro','Mujer','CC 22509141','Supernumerario','','Ep','Cerrado','NO','Sin Definir','Sin Definir','Sin Definir','Sin Definir','Sin Definir','Enfermedad laboral registrada'],
    [2018,'2018-05-21','mayo','Barranquilla','At','Carlos Alcazar Jimenez','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Ojo','Exposicion ocontacto con sustancias noci','Otras áreas comunes','Otros agentes no clasificados','Otro','Limpieza con cloro sin gafas salpica ojo izquierdo'],
    [2018,'2018-06-27','junio','Barranquilla','At','Victor Molina Cabarcas','Hombre','CC 3731132','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Otro','Otras áreas comunes','Herramientas, implementos o utensilios','Herida','Repicando matas con machete se resbala herida muneca'],
    [2018,'2018-07-07','julio','Barranquilla','At','Yusef Amaya Molina','Hombre','CC 1044391162','Ayudante de mantenimiento','Propios del trabajo','Leve','Cerrado','NO','Manos','Otro','Otras áreas comunes','Herramientas, implementos o utensilios','Amputacion o enucleacion','Prendiendo compresor rueda de metal presiona dedo'],
    [2018,'2018-07-19','julio','Tubara','At','Jeiner Duran Blanco','Hombre','CC 1048204533','Supernumerario','Deportivo','Muy leve','Cerrado','NO','Miembros inferiores','Caida de personas','Areas recreativas o deportivas','Otros agentes no clasificados','Torcedura, esguince, desgarro muscular,','Campeonato futbol interno choque con companero'],
    [2018,'2018-07-19','julio','Juan de acosta','At','Adolfo Jimenez Padilla','Hombre','CC 72122335','Ayudante de mantenimiento','Deportivo','Leve','Cerrado','NO','Miembros superiores','Caida de personas','Areas recreativas o deportivas','Otros agentes no clasificados','Torcedura, esguince, desgarro muscular,','Jugando futbol tropieza cae sobre muneca izquierda'],
    [2018,'2018-08-18','agosto','Juan de acosta','At','Reynaldo Charris Molina','Hombre','CC 1044391599','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Miembros inferiores','Caida de personas','Areas recreativas o deportivas','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Recogiendo carpas se resbala cae de espalda trauma coxis'],
    [2018,'2018-09-02','septiembre','Juan de acosta','At','Hugo Molina Rocha','Hombre','CC 72122335','Cocinero','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Otro','Otro','Herramientas, implementos o utensilios','Herida','Cortando limones cuchillo se desliza herida dedo'],
    [2019,'2019-03-12','marzo','Barranquilla','At','Miguelangel Carrillo De la rosa','Hombre','CC 1093311541','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Pisadas,choques o golpes .','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Portando equipo de sonido golpea con estructura'],
    [2019,'2019-05-14','mayo','Barranquilla','At','Luis Gabriel Torres','Hombre','CC 1093311541','Supernumerario','Deportivo','Muy leve','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Futbol interno choque con companero golpea pierna'],
    [2019,'2019-06-14','junio','Barranquilla','At','Carlos Eduardo Gomez','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Manos','Caida de objetos','Areas de produccion','Herramientas, implementos o utensilios','Herida','Cortando cebolla con cuchillo se corta dedo'],
    [2019,'2019-06-26','junio','Barranquilla','At','Jorge Arrieta','Hombre','CC 8699499','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Miembros superiores','Caida de objetos','Escaleras','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Subiendo escaleras con equipo tropieza golpea hombro'],
    [2019,'2019-07-11','julio','Barranquilla','At','Jhonattan Atencio','Hombre','CC 1004220358','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Caida de personas','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Caminando resbala con piso mojado se golpea pie'],
    [2019,'2019-07-24','julio','Barranquilla','At','Fernando Buelvas','Hombre','CC 1093312548','Supernumerario','Deportivo','Leve','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Futbol interno pisa mal lesionando rodilla derecha'],
    [2019,'2019-08-14','agosto','Barranquilla','At','Jesus Maria Villa','Hombre','CC 72126740','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Manos','Exposicion o contacto con temperatura ex','Areas de produccion','Herramientas, implementos o utensilios','Quemadura','Manipulando plancha caliente se quema mano derecha'],
    [2019,'2019-09-09','septiembre','Barranquilla','At','Santiago De la hoz','Hombre','CC 1140834571','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Otro','Otras áreas comunes','Herramientas, implementos o utensilios','Herida','Cortando vegetales cuchillo se resbala herida dedo'],
    [2019,'2019-09-16','septiembre','Barranquilla','At','Miguelangel Carrillo','Hombre','CC 1093311541','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Pies','Caida de personas','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Golpe o contusion o aplastamiento','Caminando en area recreativa resbala golpea pie'],
    [2021,'2021-07-15','julio','Barranquilla','At','Carlos Alcazar Jimenez','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Ojo','Exposicion ocontacto con sustancias noci','Otras áreas comunes','Otros agentes no clasificados','Otro','Salpica liquido de limpieza en ojo derecho'],
    [2022,'2022-06-06','junio','Barranquilla','At','Kevin Arrieta Llanos','Hombre','CC 1093316548','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Pisadas,choques o golpes .','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Golpe con puerta en mano'],
    [2022,'2022-06-17','junio','Barranquilla','At','Miguelangel Carrillo','Hombre','CC 1093311541','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Caida de personas','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Resbala bajando escalon golpea pie derecho'],
    [2022,'2022-06-22','junio','Barranquilla','At','Jairo De la ossa','Hombre','CC 1093321548','Supernumerario','Deportivo','Alta inmediata','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Otros agentes no clasificados','Torcedura, esguince, desgarro muscular,','Futbol interno pisa mal lesion tobillo derecho'],
    [2022,'2022-07-01','julio','Barranquilla','At','Luis Torres','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Caida de objetos','Areas de produccion','Herramientas, implementos o utensilios','Herida','Cortando ingredientes cuchillo se resbala'],
    [2022,'2022-07-08','julio','Barranquilla','At','Jesus Manuel Sierra','Hombre','CC 1093318874','Supernumerario','Deportivo','Muy leve','Cerrado','NO','Pies','Pisadas,choques o golpes .','Areas recreativas o deportivas','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Futbol interno choque companero golpea pie'],
    [2022,'2022-07-15','julio','Barranquilla','At','Fernando Buelvas','Hombre','CC 1093312548','Supernumerario','Deportivo','Muy leve','Cerrado','NO','Miembros inferiores','Caida de personas','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Futbol interno cae lesionando rodilla'],
    [2022,'2022-07-22','julio','Barranquilla','At','Carlos Mejia','Hombre','CC 1093317777','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Caida de objetos','Areas de produccion','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Objeto cae desde estante golpea cabeza'],
    [2022,'2022-07-29','julio','Barranquilla','At','Alexis Munoz','Hombre','CC 1093319999','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Otro','Otras áreas comunes','Herramientas, implementos o utensilios','Herida','Manipulando herramientas cortantes herida mano'],
    [2022,'2022-08-05','agosto','Barranquilla','At','David Ospino','Hombre','CC 1093320001','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Pisadas,choques o golpes .','Escaleras','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Bajando escaleras tropieza golpea pie'],
    [2022,'2022-08-19','agosto','Barranquilla','At','Andres Salgado','Hombre','CC 1093321234','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Manos','Caida de objetos','Otras áreas comunes','Herramientas, implementos o utensilios','Herida','Objeto pesado cae sobre mano'],
    [2022,'2022-08-26','agosto','Barranquilla','At','Ricardo Perez','Hombre','CC 1093322567','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Caida de personas','Otras áreas comunes','Otros agentes no clasificados','Torcedura, esguince, desgarro muscular,','Caminando resbala torcedura tobillo'],
    [2022,'2022-09-09','septiembre','Barranquilla','At','Javier Robles','Hombre','CC 1093323000','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Pisadas,choques o golpes .','Escaleras','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Subiendo escaleras golpea cabeza con borde'],
    [2022,'2022-10-14','octubre','Barranquilla','At','Daniel Castillo','Hombre','CC 1093324567','Supernumerario','Deportivo','Leve','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Futbol interno lesion rodilla izquierda'],
    [2022,'2022-10-28','octubre','Barranquilla','At','Miguelangel Carrillo','Hombre','CC 1093311541','Supernumerario','Propios del trabajo','Muy leve','Abierto','NO','Manos','Otro','Otras áreas comunes','Herramientas, implementos o utensilios','Herida','Herida leve en mano con utensilio'],
    [2022,'2022-11-11','noviembre','Barranquilla','At','Carlos Alcazar','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Muy leve','Abierto','NO','Cabeza','Otro','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Golpe en cabeza con estructura'],
    [2023,'2023-08-14','agosto','Barranquilla','At','Luis Gabriel Torres','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Pisadas,choques o golpes .','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Caminando golpea pie con objeto'],
    [2023,'2023-09-22','septiembre','Barranquilla','At','Jesus Villa','Hombre','CC 72126740','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Manos','Caida de personas','Escaleras','Herramientas, implementos o utensilios','Herida','Cayendo en escalera protege con mano se corta'],
    [2023,'2023-10-10','octubre','Barranquilla','At','Fernando Buelvas','Hombre','CC 1093312548','Supernumerario','Deportivo','Leve','Cerrado','NO','Miembros inferiores','Caida de personas','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Futbol interno cae lesionando tobillo'],
    [2024,'2024-01-15','enero','Barranquilla','At','Carlos Alcazar','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Otro','Areas de produccion','Herramientas, implementos o utensilios','Herida','Cortando con cuchillo herida leve en mano'],
    [2024,'2024-02-23','febrero','Barranquilla','At','Jorge Arrieta','Hombre','CC 8699499','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Pisadas,choques o golpes .','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Resbala golpea pie contra mueble'],
    [2024,'2024-03-08','marzo','Barranquilla','At','Kevin Arrieta','Hombre','CC 1093316548','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Caida de objetos','Areas de produccion','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Objeto cae golpea cabeza'],
    [2024,'2024-04-12','abril','Barranquilla','At','Daniel Castillo','Hombre','CC 1093324567','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Pisadas,choques o golpes .','Otras áreas comunes','Herramientas, implementos o utensilios','Golpe o contusion o aplastamiento','Golpe en mano con herramienta'],
    [2024,'2024-05-20','mayo','Barranquilla','At','Miguelangel Carrillo','Hombre','CC 1093311541','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Caida de personas','Escaleras','Ambiente de trabajo (incluye superficies','Torcedura, esguince, desgarro muscular,','Bajando escaleras pisa mal torcedura tobillo'],
    [2024,'2024-06-14','junio','Barranquilla','At','Alexis Munoz','Hombre','CC 1093319999','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Ojo','Exposicion ocontacto con sustancias noci','Areas de produccion','Otros agentes no clasificados','Otro','Salpica quimico en ojo durante limpieza'],
    [2024,'2024-06-28','junio','Barranquilla','At','Ricardo Perez','Hombre','CC 1093322567','Supernumerario','Deportivo','Muy leve','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Ambiente de trabajo (incluye superficies','Golpe o contusion o aplastamiento','Futbol interno golpe en pierna'],
    [2024,'2024-07-05','julio','Barranquilla','At','David Ospino','Hombre','CC 1093320001','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Exposicion o contacto con temperatura ex','Areas de produccion','Herramientas, implementos o utensilios','Quemadura','Quemadura leve al tocar superficie caliente'],
    [2024,'2024-08-09','agosto','Barranquilla','At','Andres Salgado','Hombre','CC 1093321234','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Cabeza','Caida de objetos','Otras áreas comunes','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Objeto cae desde anaquel golpea cabeza'],
    [2024,'2024-08-23','agosto','Barranquilla','At','Javier Robles','Hombre','CC 1093323000','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Pies','Caida de personas','Otras áreas comunes','Otros agentes no clasificados','Luxacion','Cayendo luxacion de pie'],
    [2024,'2024-09-13','septiembre','Barranquilla','At','Carlos Mejia','Hombre','CC 1093317777','Supernumerario','Propios del trabajo','Alta inmediata','Cerrado','NO','Miembros superiores','Sobreesfuerzo, esfuerzo excesivo o falso','Areas de produccion','Herramientas, implementos o utensilios','Torcedura, esguince, desgarro muscular,','Levantando objeto pesado esfuerzo excesivo hombro'],
    [2024,'2024-10-04','octubre','Barranquilla','At','Luis Torres','Hombre','CC 72282783','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Caida de objetos','Almacenes o depositos','Herramientas, implementos o utensilios','Herida','Caja cae sobre mano causando herida'],
    [2024,'2024-10-18','octubre','Barranquilla','At','Jesus Manuel Sierra','Hombre','CC 1093318874','Supernumerario','Deportivo','Muy leve','Cerrado','NO','Miembros inferiores','Pisadas,choques o golpes .','Areas recreativas o deportivas','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Futbol interno golpe en rodilla'],
    [2024,'2024-11-08','noviembre','Barranquilla','At','Fernando Buelvas','Hombre','CC 1093312548','Supernumerario','Propios del trabajo','Muy leve','Abierto','NO','Pies','Pisadas,choques o golpes .','Escaleras','Otros agentes no clasificados','Golpe o contusion o aplastamiento','Tropieza en escalera golpea pie'],
    [2024,'2024-12-06','diciembre','Barranquilla','At','Daniel Castillo','Hombre','CC 1093324567','Supernumerario','Propios del trabajo','Muy leve','Cerrado','NO','Manos','Otro','Areas de produccion','Herramientas, implementos o utensilios','Herida','Herida leve con utensilio cortante'],
  ];

  /* ---- Almacén mutable de datos (IPC o fallback a muestra) ---- */
  let DATA = [];

  /* ---- Estado del módulo ---- */
  const moduleState = {
    companyName: '',
    isLoaded: false,
    isEmpty: false,
    usingSampleData: false,
  };

  /* ---- Definición de columnas ---- */
  const COLUMNS = [
    { key: 0, label: 'Año' },
    { key: 1, label: 'Fecha' },
    { key: 2, label: 'Mes' },
    { key: 3, label: 'Ciudad' },
    { key: 4, label: 'Evento' },
    { key: 5, label: 'Nombre Completo' },
    { key: 6, label: 'Sexo' },
    { key: 7, label: 'Identificación' },
    { key: 8, label: 'Cargo' },
    { key: 9, label: 'Tipo Evento' },
    { key: 10, label: 'Severidad' },
    { key: 11, label: 'Estado' },
    { key: 12, label: 'Mortal' },
    { key: 13, label: 'Parte Afectada' },
    { key: 14, label: 'Mecanismo' },
    { key: 15, label: 'Lugar' },
    { key: 16, label: 'Agente' },
    { key: 17, label: 'Tipo Lesión' },
    { key: 18, label: 'Descripción' },
  ];

  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  /* ==========================================================
     HELPERS DE EMPRESA Y CARGA DE DATOS
     ========================================================== */

  function getCurrentCompany() {
    if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
    if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
    if (window.currentModule && window.currentModule.company) return window.currentModule.company;
    const domEl = document.getElementById('company-name');
    if (domEl && domEl.textContent && domEl.textContent.trim() !== 'Empresa') return domEl.textContent.trim();
    return localStorage.getItem('currentCompanyName') || '';
  }

  async function cargarDatosEmpresa() {
    const companyName = getCurrentCompany();
    moduleState.companyName = companyName;

    const chip = document.getElementById('kCompanyName');
    if (chip) chip.textContent = companyName || '';

    const loading = document.getElementById('kLoadingState');
    const content = document.getElementById('kDataContent');
    const empty = document.getElementById('kEmptyState');
    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';
    if (empty) empty.style.display = 'none';

    if (!companyName || !window.electronAPI || !window.electronAPI.registroEstadisticoCargarDatos) {
      DATA = SAMPLE_DATA.slice();
      moduleState.usingSampleData = true;
      moduleState.isEmpty = false;
      _finalizarCarga();
      return;
    }

    try {
      const result = await window.electronAPI.registroEstadisticoCargarDatos(companyName);
      if (result.success && result.data && result.data.length > 0) {
        DATA = result.data;
        moduleState.isEmpty = false;
        moduleState.usingSampleData = false;
      } else if (result.success && result.isEmpty) {
        DATA = [];
        moduleState.isEmpty = true;
        moduleState.usingSampleData = false;
      } else {
        console.warn('[3.2.3] IPC error, usando datos de muestra:', result.error);
        DATA = SAMPLE_DATA.slice();
        moduleState.usingSampleData = true;
        moduleState.isEmpty = false;
      }
    } catch (err) {
      console.error('[3.2.3] Error al cargar datos:', err);
      DATA = SAMPLE_DATA.slice();
      moduleState.usingSampleData = true;
      moduleState.isEmpty = false;
    }

    _finalizarCarga();
  }

  function _finalizarCarga() {
    const loading = document.getElementById('kLoadingState');
    const content = document.getElementById('kDataContent');
    const empty = document.getElementById('kEmptyState');

    if (loading) loading.style.display = 'none';

    if (moduleState.isEmpty) {
      if (empty) {
        const title = document.getElementById('kEmptyTitle');
        const desc = document.getElementById('kEmptyDesc');
        if (title) title.textContent = `No hay registros para ${moduleState.companyName || 'esta empresa'}`;
        if (desc) desc.textContent = 'No se encontró el archivo Excel en la carpeta "3.2.3 Registro Estadístico". Crea el archivo o carga los datos de muestra para continuar.';
        empty.style.display = 'flex';
      }
    } else {
      if (content) content.style.display = 'block';
      populateTableFilters();
      renderTable();
      updateTabBadges();
      populateDashFilters();
    }
    moduleState.isLoaded = true;
  }

  /* ==========================================================
     TABLA DE DATOS (Vista de Datos)
     ========================================================== */
  const tState = {
    search: '',
    filters: { anio: '', severidad: '', evento: '', ciudad: '' },
    sort: { col: -1, asc: true },
    page: 1,
    pageSize: 15,
  };

  function getFilteredData() {
    let rows = DATA.slice();
    const f = tState.filters;
    if (f.anio) rows = rows.filter(r => String(r[0]) === f.anio);
    if (f.severidad) rows = rows.filter(r => r[10] === f.severidad);
    if (f.evento) rows = rows.filter(r => r[4] === f.evento);
    if (f.ciudad) rows = rows.filter(r => r[3] === f.ciudad);
    if (tState.search) {
      const s = tState.search.toLowerCase();
      rows = rows.filter(r =>
        r[5].toLowerCase().includes(s) ||
        r[7].toLowerCase().includes(s) ||
        r[8].toLowerCase().includes(s) ||
        r[18].toLowerCase().includes(s)
      );
    }
    if (tState.sort.col >= 0) {
      const c = tState.sort.col;
      const a = tState.sort.asc ? 1 : -1;
      rows.sort((x, y) => {
        const vx = x[c], vy = y[c];
        if (typeof vx === 'number') return (vx - vy) * a;
        return String(vx).localeCompare(String(vy)) * a;
      });
    }
    return rows;
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function badgeHtml(col, val) {
    if (col === 4) return `<span class="kair-s323-badge ${val === 'At' ? 'kair-s323-badge-at' : 'kair-s323-badge-ep'}">${val === 'At' ? 'AT' : 'EP'}</span>`;
    if (col === 6) return `<span class="kair-s323-badge ${val === 'Hombre' ? 'kair-s323-badge-hombre' : 'kair-s323-badge-mujer'}">${val}</span>`;
    if (col === 10) {
      const cls = val === 'Muy leve' ? 'kair-s323-badge-muy-leve' : val === 'Alta inmediata' ? 'kair-s323-badge-alta' : val === 'Leve' ? 'kair-s323-badge-leve' : val === 'Severo' ? 'kair-s323-badge-severo' : 'kair-s323-badge-ep-sev';
      return `<span class="kair-s323-badge ${cls}">${val}</span>`;
    }
    if (col === 11) return `<span class="kair-s323-badge ${val === 'Cerrado' ? 'kair-s323-badge-cerrado' : 'kair-s323-badge-abierto'}">${val}</span>`;
    if (col === 9) {
      if (!val) return '<span class="kair-s323-badge kair-s323-badge-ep-sev">N/A</span>';
      return `<span class="kair-s323-badge ${val === 'Deportivo' ? 'kair-s323-badge-deportivo' : 'kair-s323-badge-laboral'}">${val}</span>`;
    }
    if (col === 12) return `<span class="kair-s323-badge ${val === 'SI' ? 'kair-s323-badge-severo' : 'kair-s323-badge-cerrado'}">${val}</span>`;
    return escHtml(String(val));
  }

  function renderTableHead() {
    const el = document.getElementById('kTableHead');
    if (!el) return;
    let html = '<tr>';
    COLUMNS.forEach((col, i) => {
      const sorted = tState.sort.col === i;
      const arrow = sorted ? (tState.sort.asc ? '▲' : '▼') : '⇅';
      html += `<th class="${sorted ? 'sorted' : ''}" data-col="${i}">${col.label}<span class="k-sort-icon">${arrow}</span></th>`;
    });
    html += '</tr>';
    el.innerHTML = html;
    el.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const c = parseInt(th.dataset.col);
        if (tState.sort.col === c) tState.sort.asc = !tState.sort.asc;
        else { tState.sort.col = c; tState.sort.asc = true; }
        tState.page = 1;
        renderTable();
      });
    });
  }

  function renderTableBody() {
    const allData = getFilteredData();
    const el = document.getElementById('kTableBody');
    if (!el) return 0;
    const start = (tState.page - 1) * tState.pageSize;
    const page = allData.slice(start, start + tState.pageSize);
    let html = '';
    page.forEach((r, localIdx) => {
      const globalIdx = start + localIdx;
      html += `<tr class="k-clickable-row" data-record-idx="${globalIdx}">`;
      COLUMNS.forEach((col, i) => {
        const badgeCols = [4, 6, 10, 11, 9, 12];
        html += `<td>${badgeCols.includes(i) ? badgeHtml(i, r[i]) : escHtml(String(r[i]))}</td>`;
      });
      html += '</tr>';
    });
    if (!page.length) html = `<tr><td colspan="19" style="text-align:center;color:var(--k-text-muted);padding:30px;">No se encontraron registros</td></tr>`;
    el.innerHTML = html;

    el.querySelectorAll('.k-clickable-row').forEach(tr => {
      tr.addEventListener('click', () => {
        const idx = parseInt(tr.dataset.recordIdx);
        const filtered = getFilteredData();
        if (filtered[idx]) openRecordModal(filtered[idx]);
      });
    });

    return allData.length;
  }

  function renderPagination(total) {
    const el = document.getElementById('kPagination');
    if (!el) return;
    const pages = Math.ceil(total / tState.pageSize) || 1;
    const start = (tState.page - 1) * tState.pageSize + 1;
    const end = Math.min(tState.page * tState.pageSize, total);
    let html = `<span>Mostrando ${total ? start : 0}–${end} de ${total} registros</span>`;
    html += '<div class="k-page-btns">';
    html += `<button class="k-page-btn" data-p="prev" ${tState.page <= 1 ? 'disabled' : ''}>‹ Anterior</button>`;
    const maxShow = 7;
    let pStart = Math.max(1, tState.page - 3);
    let pEnd = Math.min(pages, pStart + maxShow - 1);
    pStart = Math.max(1, pEnd - maxShow + 1);
    for (let p = pStart; p <= pEnd; p++) {
      html += `<button class="k-page-btn ${p === tState.page ? 'active' : ''}" data-p="${p}">${p}</button>`;
    }
    html += `<button class="k-page-btn" data-p="next" ${tState.page >= pages ? 'disabled' : ''}>Siguiente ›</button>`;
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.k-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.p;
        if (v === 'prev') tState.page = Math.max(1, tState.page - 1);
        else if (v === 'next') tState.page = Math.min(pages, tState.page + 1);
        else tState.page = parseInt(v);
        renderTable();
      });
    });
  }

  function renderTable() {
    renderTableHead();
    const total = renderTableBody();
    renderPagination(total);
  }

  function populateTableFilters() {
    const ids = ['kFilterAnio','kFilterSeveridad','kFilterEvento','kFilterCiudad'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) while (el.options.length > 1) el.remove(1);
    });

    const anios = [...new Set(DATA.map(r => r[0]))].sort();
    const selAnio = document.getElementById('kFilterAnio');
    if (selAnio) anios.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; selAnio.appendChild(o); });

    const sevs = [...new Set(DATA.map(r => r[10]))].sort();
    const selSev = document.getElementById('kFilterSeveridad');
    if (selSev) sevs.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; selSev.appendChild(o); });

    const evts = [...new Set(DATA.map(r => r[4]))].sort();
    const selEvt = document.getElementById('kFilterEvento');
    if (selEvt) evts.forEach(e => { const o = document.createElement('option'); o.value = e; o.textContent = e === 'At' ? 'Accidente de Trabajo' : 'Enfermedad Laboral'; selEvt.appendChild(o); });

    const ciuds = [...new Set(DATA.map(r => r[3]))].sort();
    const selCiu = document.getElementById('kFilterCiudad');
    if (selCiu) ciuds.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; selCiu.appendChild(o); });
  }

  function bindTableEvents() {
    const si = document.getElementById('kSearchInput');
    if (si) si.addEventListener('input', e => { tState.search = e.target.value; tState.page = 1; renderTable(); });
    const fa = document.getElementById('kFilterAnio');
    if (fa) fa.addEventListener('change', e => { tState.filters.anio = e.target.value; tState.page = 1; renderTable(); });
    const fs = document.getElementById('kFilterSeveridad');
    if (fs) fs.addEventListener('change', e => { tState.filters.severidad = e.target.value; tState.page = 1; renderTable(); });
    const fe = document.getElementById('kFilterEvento');
    if (fe) fe.addEventListener('change', e => { tState.filters.evento = e.target.value; tState.page = 1; renderTable(); });
    const fc = document.getElementById('kFilterCiudad');
    if (fc) fc.addEventListener('change', e => { tState.filters.ciudad = e.target.value; tState.page = 1; renderTable(); });
  }

  /* ==========================================================
     TAB BADGES
     ========================================================== */
  function updateTabBadges() {
    const count = DATA.length;
    const b1 = document.getElementById('kTabBadgeDatos');
    const b2 = document.getElementById('kTabBadgeTablero');
    if (b1) b1.textContent = count;
    if (b2) b2.textContent = count;
  }

  /* ==========================================================
     MODAL DE DETALLE
     ========================================================== */
  function openRecordModal(record) {
    const backdrop = document.getElementById('kModalBackdrop');
    const grid = document.getElementById('kModalGrid');
    if (!backdrop || !grid) return;

    const fields = [
      { label: 'Año', value: record[0], full: false },
      { label: 'Fecha', value: record[1], full: false },
      { label: 'Mes', value: record[2], full: false },
      { label: 'Ciudad', value: record[3], full: false },
      { label: 'Tipo de Evento', value: record[4] === 'At' ? 'Accidente de Trabajo (AT)' : record[4] === 'Ep' ? 'Enfermedad Laboral (EP)' : record[4], full: false },
      { label: 'Nombre Completo', value: record[5], full: false },
      { label: 'Sexo', value: record[6], full: false },
      { label: 'Identificación', value: record[7], full: false },
      { label: 'Cargo', value: record[8], full: false },
      { label: 'Clasificación Evento', value: record[9] || 'N/A', full: false },
      { label: 'Severidad', value: record[10], full: false },
      { label: 'Estado', value: record[11], full: false },
      { label: 'Mortal', value: record[12], full: false },
      { label: 'Parte Afectada', value: record[13], full: false },
      { label: 'Mecanismo', value: record[14], full: true },
      { label: 'Lugar del Evento', value: record[15], full: false },
      { label: 'Agente Causante', value: record[16], full: true },
      { label: 'Tipo de Lesión', value: record[17], full: false },
      { label: 'Descripción del Evento', value: record[18], full: true },
    ];

    grid.innerHTML = fields.map(f => `
      <div class="kair-s323-modal-field ${f.full ? 'full-width' : ''}">
        <div class="kair-s323-modal-field-label">${escHtml(f.label)}</div>
        <div class="kair-s323-modal-field-value">${escHtml(String(f.value || '—'))}</div>
      </div>
    `).join('');

    const title = document.getElementById('kModalTitle');
    if (title) title.textContent = `${record[5]} — ${record[1]}`;
    backdrop.style.display = 'flex';
  }

  function closeModal() {
    const backdrop = document.getElementById('kModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  function bindModal() {
    const closeBtn = document.getElementById('kModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const backdrop = document.getElementById('kModalBackdrop');
    if (backdrop) backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  }

  /* ==========================================================
     EXPORTAR CSV
     ========================================================== */
  function exportCsv() {
    const exportData = getFilteredData();
    if (!exportData.length) return;
    const header = COLUMNS.map(c => `"${c.label}"`).join(',');
    const rows = exportData.map(r =>
      r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-estadistico-${(moduleState.companyName || 'empresa').replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ==========================================================
     DASHBOARD ESTADÍSTICO
     ========================================================== */
  let dashCharts = [];

  function getDashFilters() {
    return {
      desde: parseInt(document.getElementById('kDashDesde').value) || 0,
      hasta: parseInt(document.getElementById('kDashHasta').value) || 9999,
      ciudad: document.getElementById('kDashCiudad').value,
      tipoEvento: document.getElementById('kDashTipoEvento').value,
      severidad: document.getElementById('kDashSeveridad').value,
    };
  }

  function filterData(df) {
    return DATA.filter(r => {
      if (r[0] < df.desde || r[0] > df.hasta) return false;
      if (df.ciudad !== 'Todos' && r[3] !== df.ciudad) return false;
      if (df.tipoEvento !== 'Todos' && r[4] !== df.tipoEvento) return false;
      if (df.severidad !== 'Todos' && r[10] !== df.severidad) return false;
      return true;
    });
  }

  function populateDashFilters() {
    if (!DATA.length) return;
    const anios = [...new Set(DATA.map(r => r[0]))].sort();

    const selD = document.getElementById('kDashDesde');
    const selH = document.getElementById('kDashHasta');
    if (selD) {
      while (selD.options.length) selD.remove(0);
      anios.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; selD.appendChild(o); });
      selD.value = anios[0];
    }
    if (selH) {
      while (selH.options.length) selH.remove(0);
      anios.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; selH.appendChild(o); });
      selH.value = anios[anios.length - 1];
    }

    const ciuds = [...new Set(DATA.map(r => r[3]))].sort();
    const selC = document.getElementById('kDashCiudad');
    if (selC) {
      while (selC.options.length > 1) selC.remove(1);
      ciuds.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; selC.appendChild(o); });
    }

    const periodText = document.getElementById('kPeriodText');
    if (periodText && anios.length) periodText.textContent = `${anios[0]} – ${anios[anios.length - 1]}`;
  }

  function bindDashEvents() {
    ['kDashDesde','kDashHasta','kDashCiudad','kDashTipoEvento','kDashSeveridad'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', renderDashboard);
    });
    const clearBtn = document.getElementById('kBtnClearFilters');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      const anios = [...new Set(DATA.map(r => r[0]))].sort();
      const selD = document.getElementById('kDashDesde');
      const selH = document.getElementById('kDashHasta');
      if (selD && anios.length) selD.value = anios[0];
      if (selH && anios.length) selH.value = anios[anios.length - 1];
      const sc = document.getElementById('kDashCiudad');
      const se = document.getElementById('kDashTipoEvento');
      const ss = document.getElementById('kDashSeveridad');
      if (sc) sc.value = 'Todos';
      if (se) se.value = 'Todos';
      if (ss) ss.value = 'Todos';
      renderDashboard();
    });
  }

  function destroyCharts() {
    dashCharts.forEach(c => { try { c.destroy(); } catch (e) { /* ignore */ } });
    dashCharts = [];
  }

  function countBy(data, idx) {
    const m = {};
    data.forEach(r => { const k = r[idx] || 'Sin clasificar'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  function trendHtml(curr, prev) {
    if (prev === 0 && curr === 0) return '<span class="k-kpi-trend-neutral">— sin datos previos</span>';
    if (prev === 0) return `<span class="k-kpi-trend-up">▲ nuevo (${curr})</span>`;
    const diff = ((curr - prev) / prev) * 100;
    const cls = diff > 0 ? 'k-kpi-trend-up' : diff < 0 ? 'k-kpi-trend-down' : 'k-kpi-trend-neutral';
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
    return `<span class="${cls}">${arrow} ${Math.abs(diff).toFixed(1)}% vs periodo anterior</span>`;
  }

  function getPrevPeriod(df) {
    const span = df.hasta - df.desde + 1;
    return { desde: df.desde - span, hasta: df.hasta - span, ciudad: df.ciudad, tipoEvento: df.tipoEvento, severidad: df.severidad };
  }

  function renderKPIs(data, df) {
    const prevData = filterData(getPrevPeriod(df));
    const total = data.length;
    const atCount = data.filter(r => r[4] === 'At').length;
    const epCount = data.filter(r => r[4] === 'Ep').length;
    const severos = data.filter(r => r[10] === 'Severo' || r[12] === 'SI').length;
    const cerrados = data.filter(r => r[11] === 'Cerrado').length;
    const abiertos = data.filter(r => r[11] === 'Abierto').length;
    const atLab = data.filter(r => r[4] === 'At' && r[9] === 'Propios del trabajo').length;
    const atDep = data.filter(r => r[4] === 'At' && r[9] === 'Deportivo').length;
    const uniqueMonths = new Set(data.map(r => r[2]));
    const tasaXmes = uniqueMonths.size > 0 ? (total / uniqueMonths.size).toFixed(1) : 0;
    const prevAt = prevData.filter(r => r[4] === 'At').length;
    const prevEp = prevData.filter(r => r[4] === 'Ep').length;

    const kpis = [
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Total Eventos', value: total, sub: trendHtml(total, prevData.length), accent: 'primary' },
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Accidentes de Trabajo', value: atCount, sub: `${((atCount / total) * 100 || 0).toFixed(1)}% del total · ${trendHtml(atCount, prevAt)}`, accent: 'info' },
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Enfermedades Laborales', value: epCount, sub: trendHtml(epCount, prevEp), accent: 'purple' },
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Severos / Mortales', value: severos, sub: severos > 0 ? '<span class="k-kpi-trend-up">⚠ Requiere atención inmediata</span>' : '<span class="k-kpi-trend-down">✓ Sin casos severos</span>', accent: 'danger' },
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Casos Cerrados', value: cerrados, sub: `${((cerrados / total) * 100 || 0).toFixed(1)}% de cierre`, accent: 'success' },
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Casos Abiertos', value: abiertos, sub: abiertos > 0 ? `<span class="k-kpi-trend-up">${abiertos} pendiente(s) de cierre</span>` : '<span class="k-kpi-trend-down">Todos cerrados</span>', accent: 'warning' },
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Tasa por Mes', value: tasaXmes, sub: `eventos promedio/mes (${uniqueMonths.size} meses con registro)`, accent: 'primary' },
      { label: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Laboral vs Deportivo', value: `${atLab} / ${atDep}`, sub: `Laboral ${((atLab / (atLab + atDep || 1)) * 100).toFixed(0)}% · Deportivo ${((atDep / (atLab + atDep || 1)) * 100).toFixed(0)}%`, accent: 'info' },
    ];

    const grid = document.getElementById('kKpiGrid');
    if (grid) grid.innerHTML = kpis.map(k => `
      <div class="kair-s323-kpi-card">
        <div class="k-kpi-accent-bar kair-s323-kpi-accent-${k.accent}"></div>
        <div class="k-kpi-label">${k.label}</div>
        <div class="k-kpi-value">${k.value}</div>
        <div class="k-kpi-sub">${k.sub}</div>
      </div>
    `).join('');
  }

  function renderSGSST(data, df) {
    const atRecords = data.filter(r => r[4] === 'At');
    const numAT = atRecords.length;
    const numYears = Math.max(df.hasta - df.desde + 1, 1);
    const totalHoras = 200000 * numYears;
    const baselineWorkers = 200;
    let totalDiasPerdidos = 0;
    atRecords.forEach(r => {
      const s = r[10];
      if (s === 'Alta inmediata') totalDiasPerdidos += 1;
      else if (s === 'Leve') totalDiasPerdidos += 3;
      else if (s === 'Severo') totalDiasPerdidos += 15;
    });
    const ifa = totalHoras > 0 ? (numAT / totalHoras) * 1000000 : 0;
    const ig = totalHoras > 0 ? (totalDiasPerdidos / totalHoras) * 1000000 : 0;
    const pa = baselineWorkers > 0 ? (numAT / (baselineWorkers * numYears)) * 100 : 0;
    const ifaS = ifa < 5 ? 'green' : ifa < 15 ? 'yellow' : 'red';
    const igS = ig < 50 ? 'green' : ig < 200 ? 'yellow' : 'red';
    const paS = pa < 3 ? 'green' : pa < 8 ? 'yellow' : 'red';
    const lbl = { green: 'Aceptable', yellow: 'Moderado', red: 'Crítico' };
    const colorOf = s => s === 'green' ? 'var(--k-success)' : s === 'yellow' ? '#e67e00' : 'var(--k-danger)';
    const borderOf = s => s === 'green' ? 'var(--k-success)' : s === 'yellow' ? 'var(--k-warning)' : 'var(--k-danger)';
    const el = document.getElementById('kSgsstGrid');
    if (el) el.innerHTML = [
      { label: 'Índice de Frecuencia de Accidentes (IFA)', val: ifa.toFixed(2), formula: '(No. AT ÷ Horas trabajadas) × 1.000.000', s: ifaS },
      { label: 'Índice de Gravedad (IG)', val: ig.toFixed(2), formula: '(Días perdidos ÷ Horas trabajadas) × 1.000.000', s: igS },
      { label: 'Proporción de Accidentabilidad', val: pa.toFixed(2) + '%', formula: '(No. AT ÷ Total trabajadores expuestos) × 100', s: paS },
    ].map(i => `
      <div class="kair-s323-sgsst-item" style="border-top:3px solid ${borderOf(i.s)}">
        <div class="k-sgsst-label">${i.label}</div>
        <div class="k-sgsst-value" style="color:${colorOf(i.s)}">${i.val}</div>
        <div class="k-sgsst-formula">${i.formula}</div>
        <span class="k-sgsst-status kair-s323-sgsst-${i.s}">${lbl[i.s]}</span>
      </div>
    `).join('');
  }

  function renderAlerts(data) {
    const alerts = [];
    const avgByMonth = data.length / 12;
    countBy(data, 2).forEach(([mes, cnt]) => {
      if (cnt >= avgByMonth * 1.8) alerts.push({ type: 'red', icon: '🔴', title: `Pico en ${mes}`, desc: `Se registraron ${cnt} eventos en ${mes}, por encima del promedio de ${avgByMonth.toFixed(1)} eventos/mes.` });
    });
    const byYear = countBy(data, 0);
    for (let i = 1; i < byYear.length; i++) {
      const prev = byYear[i - 1], curr = byYear[i];
      if (prev[1] > 0 && curr[1] > prev[1] * 1.5) alerts.push({ type: 'orange', icon: '🟠', title: `Aumento significativo en ${curr[0]}`, desc: `${curr[1]} eventos vs ${prev[1]} en ${prev[0]}, un incremento del ${(((curr[1] - prev[1]) / prev[1]) * 100).toFixed(0)}%.` });
    }
    const byCity = countBy(data, 3);
    if (byCity.length > 1 && (byCity[0][1] / data.length) * 100 > 70) alerts.push({ type: 'yellow', icon: '🟡', title: `Concentración en ${byCity[0][0]}`, desc: `El ${((byCity[0][1] / data.length) * 100).toFixed(0)}% de los eventos ocurrieron en ${byCity[0][0]}.` });
    countBy(data, 5).filter(p => p[1] >= 3).forEach(([name, cnt]) => alerts.push({ type: 'red', icon: '🔴', title: `Trabajador recurrente: ${name}`, desc: `Presenta ${cnt} eventos registrados. Se recomienda evaluación de puesto y capacitación.` }));
    countBy(data, 5).filter(p => p[1] === 2).forEach(([name]) => alerts.push({ type: 'blue', icon: '🔵', title: `2 eventos: ${name}`, desc: 'Trabajador con 2 eventos registrados. Monitoreo recomendado.' }));
    const byInjury = countBy(data, 13);
    if (byInjury[0] && byInjury[0][1] >= 10) alerts.push({ type: 'yellow', icon: '🟡', title: 'Parte del cuerpo más afectada', desc: `"${byInjury[0][0]}" concentra ${byInjury[0][1]} eventos (${((byInjury[0][1] / data.length) * 100).toFixed(0)}%).` });
    if (!alerts.length) alerts.push({ type: 'blue', icon: '🔵', title: 'Sin alertas críticas', desc: 'No se detectaron patrones de riesgo significativos en el periodo seleccionado.' });
    const el = document.getElementById('kAlertList');
    if (el) el.innerHTML = alerts.map(a => `
      <div class="kair-s323-alert-item kair-s323-alert-${a.type}">
        <span class="k-alert-icon">${a.icon}</span>
        <div class="k-alert-content">
          <div class="k-alert-title">${a.title}</div>
          <div class="k-alert-desc">${a.desc}</div>
        </div>
      </div>
    `).join('');
  }

  const CHART_COLORS = ['#174ea6','#28a745','#ffc107','#dc3545','#17a2b8','#6f42c1','#fd7e14','#20c997','#e83e8c','#6610f2'];

  function renderCharts(data) {
    destroyCharts();

    const byYear = countBy(data, 0).sort((a, b) => a[0] - b[0]);
    const avgYear = data.length / Math.max(byYear.length, 1);
    dashCharts.push(new Chart(document.getElementById('kChartByYear'), {
      type: 'bar',
      data: { labels: byYear.map(y => y[0]), datasets: [{ label: 'Eventos', data: byYear.map(y => y[1]), backgroundColor: '#174ea6', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      plugins: [{ id: 'avgLine', afterDatasetsDraw(chart) {
        const { ctx, chartArea: { left, right }, scales: { y } } = chart;
        const yPos = y.getPixelForValue(avgYear);
        ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#dc3545'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(left, yPos); ctx.lineTo(right, yPos); ctx.stroke();
        ctx.fillStyle = '#dc3545'; ctx.font = '11px Segoe UI'; ctx.textAlign = 'right';
        ctx.fillText(`Prom: ${avgYear.toFixed(1)}`, right, yPos - 5); ctx.restore();
      }}]
    }));

    const bySev = countBy(data, 10);
    dashCharts.push(new Chart(document.getElementById('kChartSeveridad'), {
      type: 'doughnut',
      data: { labels: bySev.map(s => s[0]), datasets: [{ data: bySev.map(s => s[1]), backgroundColor: ['#28a745','#ffc107','#17a2b8','#dc3545','#6f42c1'] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, font: { size: 11 } } } } }
    }));

    const monthCounts = MONTHS.map(m => data.filter(r => r[2] === m).length);
    dashCharts.push(new Chart(document.getElementById('kChartMensual'), {
      type: 'bar',
      data: { labels: MONTH_SHORT, datasets: [{ label: 'Eventos', data: monthCounts, backgroundColor: monthCounts.map(c => c >= 10 ? '#dc3545' : c >= 6 ? '#ffc107' : '#174ea6'), borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    }));

    const byParte = countBy(data, 13).slice(0, 8);
    dashCharts.push(new Chart(document.getElementById('kChartParteCuerpo'), {
      type: 'bar',
      data: { labels: byParte.map(p => p[0]), datasets: [{ label: 'Eventos', data: byParte.map(p => p[1]), backgroundColor: '#17a2b8', borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    }));

    const byMec = countBy(data, 14);
    dashCharts.push(new Chart(document.getElementById('kChartMecanismo'), {
      type: 'bar',
      data: { labels: byMec.map(m => m[0].length > 35 ? m[0].substring(0, 35) + '…' : m[0]), datasets: [{ label: 'Eventos', data: byMec.map(m => m[1]), backgroundColor: '#28a745', borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    }));

    const byLugar = countBy(data, 15);
    dashCharts.push(new Chart(document.getElementById('kChartLugar'), {
      type: 'bar',
      data: { labels: byLugar.map(l => l[0]), datasets: [{ label: 'Eventos', data: byLugar.map(l => l[1]), backgroundColor: '#6f42c1', borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    }));

    const years = [...new Set(data.map(r => r[0]))].sort();
    dashCharts.push(new Chart(document.getElementById('kChartTipoAnio'), {
      type: 'bar',
      data: { labels: years, datasets: [
        { label: 'Deportivo', data: years.map(y => data.filter(r => r[0] === y && r[9] === 'Deportivo').length), backgroundColor: '#fd7e14', borderRadius: 4 },
        { label: 'Propios del trabajo', data: years.map(y => data.filter(r => r[0] === y && r[9] === 'Propios del trabajo').length), backgroundColor: '#174ea6', borderRadius: 4 },
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 } } } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } } }
    }));

    const byLesion = countBy(data, 17).filter(l => l[0] !== 'Sin Definir');
    dashCharts.push(new Chart(document.getElementById('kChartTipoLesion'), {
      type: 'doughnut',
      data: { labels: byLesion.map(l => l[0]), datasets: [{ data: byLesion.map(l => l[1]), backgroundColor: CHART_COLORS.slice(0, byLesion.length) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true, font: { size: 10 } } } } }
    }));

    const sevList = ['Muy leve', 'Alta inmediata', 'Leve', 'Severo'];
    dashCharts.push(new Chart(document.getElementById('kChartSevSexo'), {
      type: 'bar',
      data: { labels: sevList, datasets: [
        { label: 'Hombre', data: sevList.map(s => data.filter(r => r[10] === s && r[6] === 'Hombre').length), backgroundColor: '#1565c0', borderRadius: 4 },
        { label: 'Mujer', data: sevList.map(s => data.filter(r => r[10] === s && r[6] === 'Mujer').length), backgroundColor: '#c62828', borderRadius: 4 },
      ]},
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    }));
  }

  function renderTop5(data) {
    const total = data.length || 1;
    const byMec = countBy(data, 14).slice(0, 5);
    const byLug = countBy(data, 15).slice(0, 5);
    const tableHtml = items => `<table class="kair-s323-top5-table">
      <thead><tr><th>#</th><th>Concepto</th><th>Cant.</th><th>%</th></tr></thead>
      <tbody>${items.map((it, i) => {
        const pct = ((it[1] / total) * 100).toFixed(1);
        return `<tr><td style="font-weight:600;">${i + 1}</td><td>${escHtml(it[0])}</td><td><strong>${it[1]}</strong></td>
          <td class="kair-s323-pct-cell"><div style="display:flex;align-items:center;gap:8px;">
            <div class="kair-s323-progress-bar-wrap" style="flex:1;"><div class="kair-s323-progress-bar" style="width:${pct}%;"></div></div>
            <span style="font-size:0.78rem;color:var(--k-text-muted);min-width:38px;">${pct}%</span>
          </div></td></tr>`;
      }).join('')}</tbody></table>`;
    const m = document.getElementById('kTop5Mecanismos');
    const l = document.getElementById('kTop5Lugares');
    if (m) m.innerHTML = tableHtml(byMec);
    if (l) l.innerHTML = tableHtml(byLug);
  }

  function renderRecommendations(data) {
    const recs = [];
    const byMec = countBy(data, 14);
    if (byMec.length) {
      const top = byMec[0];
      recs.push(`<strong>Control de "${top[0]}":</strong> Este mecanismo representa el ${(top[1] / data.length * 100).toFixed(0)}% de los eventos (${top[1]} casos). Se recomienda implementar barreras de control específicas, señalización visible y capacitaciones enfocadas en la prevención. Realizar inspecciones periódicas en las áreas donde se presenta con mayor frecuencia.`);
    }
    const byParte = countBy(data, 13);
    if (byParte.length) {
      const top = byParte[0];
      const p = top[0].toLowerCase();
      let ppe = 'elementos de protección personal específicos para la zona afectada';
      if (p.includes('mano')) ppe = 'guantes de protección adecuados al tipo de labor, evitar el uso de herramientas defectuosas';
      else if (p.includes('pie')) ppe = 'calzado de seguridad con puntera reforzada, mantener pisos limpios y secos';
      else if (p.includes('cabeza')) ppe = 'casco de seguridad en zonas de riesgo de caída de objetos, verificar estabilidad de estanterías';
      else if (p.includes('ojo')) ppe = 'gafas de seguridad para tareas de limpieza y manipulación de químicos';
      else if (p.includes('inferior') || p.includes('miembro')) ppe = 'protección para extremidades inferiores, ejercicios de calentamiento antes de actividades deportivas';
      recs.push(`<strong>Protección de "${top[0]}":</strong> Con ${top[1]} casos (${(top[1] / data.length * 100).toFixed(0)}%), se recomienda suministrar y exigir el uso de ${ppe}. Realizar charlas de autocuidado enfocadas en esta parte del cuerpo.`);
    }
    const topMonths = countBy(data, 2).slice(0, 3).map(m => m[0]);
    if (topMonths.length >= 2) recs.push(`<strong>Patrón estacional:</strong> Los meses de ${topMonths.join(', ')} concentran la mayor cantidad de eventos. Se recomienda intensificar las campañas de prevención durante estos periodos, reforzando la supervisión y la dotación de EPP.`);
    const byLugar = countBy(data, 15);
    if (byLugar.length) {
      const top = byLugar[0];
      recs.push(`<strong>Mejora de infraestructura en "${top[0]}":</strong> Con ${top[1]} eventos (${(top[1] / data.length * 100).toFixed(0)}%), es crítico realizar una evaluación de condiciones de seguridad. Mejorar iluminación, señalización y superficies de tránsito.`);
    }
    const depCount = data.filter(r => r[9] === 'Deportivo').length;
    if (depCount >= 3) recs.push(`<strong>Eventos deportivos (${depCount} casos):</strong> Implementar protocolo de calentamiento obligatorio. Evaluar pólizas adicionales para actividades recreativas y considerar la regulación de prácticas de alto contacto.`);
    const stairCount = data.filter(r => r[15] === 'Escaleras').length;
    if (stairCount >= 3) recs.push(`<strong>Seguridad en escaleras (${stairCount} casos):</strong> Instalar antiadherentes en peldaños, mejorar iluminación, colocar pasamanos en ambos lados y señalizar visiblemente el riesgo.`);
    if (!recs.length) recs.push('No hay suficientes datos para generar recomendaciones específicas.');
    const el = document.getElementById('kRecsList');
    if (el) el.innerHTML = recs.map(r => `<li>${r}</li>`).join('');
  }

  function renderDashboard() {
    const df = getDashFilters();
    const periodText = document.getElementById('kPeriodText');
    if (periodText) periodText.textContent = `${df.desde} – ${df.hasta}`;
    const filtered = filterData(df);
    renderKPIs(filtered, df);
    renderSGSST(filtered, df);
    renderAlerts(filtered);
    renderCharts(filtered);
    renderTop5(filtered);
    renderRecommendations(filtered);
  }

  /* ==========================================================
     TAB SWITCHING
     ========================================================== */
  function bindTabs() {
    document.querySelectorAll('.kair-s323-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.kair-s323-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.kair-s323-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.tab === 'datos') {
          document.getElementById('panelDatos').classList.add('active');
        } else {
          document.getElementById('panelTablero').classList.add('active');
          if (DATA.length) setTimeout(renderDashboard, 50);
        }
      });
    });
  }

  /* ==========================================================
     INIT
     ========================================================== */
  function init() {
    bindTableEvents();
    bindDashEvents();
    bindTabs();
    bindModal();

    const backBtn = document.getElementById('kBtnBack');
    if (backBtn) backBtn.addEventListener('click', () => {
      window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    });

    const refreshBtn = document.getElementById('kBtnRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
      tState.search = '';
      tState.filters = { anio: '', severidad: '', evento: '', ciudad: '' };
      tState.page = 1;
      const si = document.getElementById('kSearchInput');
      if (si) si.value = '';
      cargarDatosEmpresa();
    });

    const csvBtn = document.getElementById('kBtnExportCsv');
    if (csvBtn) csvBtn.addEventListener('click', exportCsv);

    const printBtn = document.getElementById('kBtnPrintDash');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const sampleBtn = document.getElementById('kBtnLoadSample');
    if (sampleBtn) sampleBtn.addEventListener('click', () => {
      DATA = SAMPLE_DATA.slice();
      moduleState.isEmpty = false;
      moduleState.usingSampleData = true;
      const empty = document.getElementById('kEmptyState');
      const content = document.getElementById('kDataContent');
      if (empty) empty.style.display = 'none';
      if (content) content.style.display = 'block';
      populateTableFilters();
      renderTable();
      updateTabBadges();
      populateDashFilters();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        const tablero = document.getElementById('panelTablero');
        if (tablero && tablero.classList.contains('active')) {
          e.preventDefault();
          window.print();
        }
      }
    });

    cargarDatosEmpresa();
  }

  init();

  /* ==========================================================
     API PÚBLICA (para coordinación con gestion-salud-home.js)
     ========================================================== */
  window.kairRegistroEstadistico = {
    refresh: cargarDatosEmpresa,
    getCount: () => DATA.length,
    getCompany: () => moduleState.companyName,
    isUsingSampleData: () => moduleState.usingSampleData,
    isEmpty: () => moduleState.isEmpty,
  };

})();
