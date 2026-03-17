# Roles y Permisos (RBAC) - K+AIR

## Objetivo
Definir el catalogo de roles y la matriz de permisos para la aplicacion K+AIR bajo un modelo RBAC (Role Based Access Control), sin modificar contratos ni logica existente.

## Alcance
- Aplica a todas las empresas gestionadas por la app.
- El rol "Administrador del Sistema" es global (todas las empresas).
- Los demas roles se asignan por empresa.

## Convencion de permisos
Formato canonico:

  modulo.submodulo.accion

Ejemplos:
- recursos.inducciones.sincronizar
- salud.investigacion-accidentes.analizar_ia

## Acciones estandar
- ver
- crear
- editar
- eliminar
- exportar
- administrar
- analizar_ia
- sincronizar

Acciones especiales por dominio:
- salud.*: generar_informe, seguimiento_pric
- gestion-integral.*: aprobar
- operativos: cerrar

## Modulos y submodulos (prefijos canonicos)
- recursos.*
  responsable-sg, roles-responsabilidades, presupuesto, afiliacion, trabajo-alto-riesgo, copasst, capacitacion-copasst, comite-convivencia, capacitaciones, inducciones, curso-virtual
- salud.*
  sociodemografica, evaluaciones-medicas, restricciones-medicas, reportes-accidentes, investigacion-accidentes, ausentismo
- gestion-integral.*
  politica, objetivos, plan-trabajo, rendicion
- gestion-peligros.*
- gestion-amenazas.*
- verificacion.*
- mejoramiento.*

## Catalogo de roles (vigente)
1. Administrador del Sistema (global)
   - Acceso: todos los permisos.
   - Ambito: todas las empresas.

2. Responsable SST
   - Acceso: recursos.*, salud.*, gestion-integral.*, gestion-peligros.*, gestion-amenazas.*, verificacion.*, mejoramiento.*
   - Acciones: incluye analizar_ia y seguimiento_pric.

3. Gerencia
   - Acceso: gestion-integral.*, verificacion.*, mejoramiento.*
   - Acciones: ver, aprobar, exportar.

4. Recursos Humanos
   - Acceso: recursos.afiliacion, recursos.capacitaciones, recursos.inducciones, salud.evaluaciones-medicas, salud.restricciones-medicas, salud.ausentismo
   - Acciones: ver, crear, editar.

## Matriz por modulo (detallada)
Nota: "Administrador del Sistema" tiene todos los permisos en todos los modulos.

### recursos.*
Acciones base: ver, crear, editar, exportar.  
Accion especial: sincronizar (solo recursos.inducciones).

Submodulo | Responsable SST | Gerencia | Recursos Humanos
---|---|---|---
recursos.responsable-sg | ver, crear, editar, exportar | - | -
recursos.roles-responsabilidades | ver, crear, editar, exportar | - | -
recursos.presupuesto | ver, crear, editar, exportar | - | -
recursos.afiliacion | ver, crear, editar, exportar | - | ver, crear, editar
recursos.trabajo-alto-riesgo | ver, crear, editar, exportar | - | -
recursos.copasst | ver, crear, editar, exportar | - | -
recursos.capacitacion-copasst | ver, crear, editar, exportar | - | -
recursos.comite-convivencia | ver, crear, editar, exportar | - | -
recursos.capacitaciones | ver, crear, editar, exportar | - | ver, crear, editar
recursos.inducciones | ver, crear, editar, exportar, sincronizar | - | ver, crear, editar
recursos.curso-virtual | ver, crear, editar, exportar | - | -

### salud.*
Acciones base: ver, crear, editar, exportar.  
Acciones especiales: analizar_ia, generar_informe, seguimiento_pric.

Submodulo | Responsable SST | Gerencia | Recursos Humanos
---|---|---|---
salud.sociodemografica | ver, crear, editar, exportar | - | -
salud.evaluaciones-medicas | ver, crear, editar, exportar | - | ver, crear, editar
salud.restricciones-medicas | ver, crear, editar, exportar | - | ver, crear, editar
salud.reportes-accidentes | ver, crear, editar, exportar | - | -
salud.investigacion-accidentes | ver, crear, editar, exportar, analizar_ia, generar_informe | - | -
salud.ausentismo | ver, crear, editar, exportar, seguimiento_pric | - | ver, crear, editar

### gestion-integral.*
Acciones base: ver, editar, exportar, aprobar.

Submodulo | Responsable SST | Gerencia | Recursos Humanos
---|---|---|---
gestion-integral.politica | ver, editar, exportar, aprobar | ver, exportar, aprobar | -
gestion-integral.objetivos | ver, editar, exportar, aprobar | ver, exportar, aprobar | -
gestion-integral.plan-trabajo | ver, editar, exportar, aprobar | ver, exportar, aprobar | -
gestion-integral.rendicion | ver, editar, exportar, aprobar | ver, exportar, aprobar | -

### gestion-peligros.*
Acciones base: ver, crear, editar, cerrar.

Submodulo | Responsable SST | Gerencia | Recursos Humanos
---|---|---|---
gestion-peligros.* | ver, crear, editar, cerrar | - | -

### gestion-amenazas.*
Acciones base: ver, crear, editar, cerrar.

Submodulo | Responsable SST | Gerencia | Recursos Humanos
---|---|---|---
gestion-amenazas.* | ver, crear, editar, cerrar | - | -

### verificacion.*
Acciones base: ver, crear, editar, cerrar, exportar.

Submodulo | Responsable SST | Gerencia | Recursos Humanos
---|---|---|---
verificacion.* | ver, crear, editar, cerrar, exportar | ver, exportar, aprobar | -

### mejoramiento.*
Acciones base: ver, crear, editar, cerrar, exportar.

Submodulo | Responsable SST | Gerencia | Recursos Humanos
---|---|---|---
mejoramiento.* | ver, crear, editar, cerrar, exportar | ver, exportar, aprobar | -

## Matriz resumida
- Administrador: todo.
- Responsable SST: todo operativo + estrategico.
- Gerencia: estrategico + verificacion/mejoramiento (sin edicion operativa).
- Recursos Humanos: salud + afiliaciones.

## Reglas de alcance
- Administrador del Sistema: permisos globales sobre todas las empresas.
- Roles por empresa: los permisos aplican solo a la empresa asignada en la sesion actual.

## Notas
- Se excluyen por ahora los roles Supervisor y Auditor. Se pueden reincorporar en una version futura.
- Esta definicion es documental. La implementacion se realizara en una fase posterior sin romper contratos IPC existentes.
