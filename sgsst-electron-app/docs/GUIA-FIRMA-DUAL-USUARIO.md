# K+AIR · Guía rápida: Firma dual (trabajador + empresa)

**Versión:** 0.1.180 · Septiembre 2026

---

## ¿Qué es la firma dual?

Es cuando un documento necesita 2 firmas: la del **trabajador** Y la del **representante legal** de la empresa. Las dos firmas quedan en el mismo PDF.

## ¿Cuándo usarla?

- Cartas de compromiso (alcohol, droga, confidencialidad)
- Reglamentos internos (higiene, seguridad industrial)
- Contratos con cláusulas especiales
- Actas de COPASST / Comité de Convivencia
- Cartas de aceptación de EPP
- Política empresa-wide firmada por cada trabajador

## ¿Cómo configurar el representante legal?

> **Solo se hace 1 vez por empresa.**

1. Ir a **Configuración** → **Empresas**
2. Click en **Editar** de la empresa
3. Bajar hasta la sección **"Representante Legal"** (al final)
4. Llenar los campos:
   - **Nombre completo*** (obligatorio)
   - **Tipo ID** (CC, CE, TI)
   - **Número*** (obligatorio)
   - **Correo*** ⚠️ **obligatorio** (recibe el código de firma)
   - **Teléfono** (opcional)
   - **Cargo** (ej: "Representante Legal")
5. Click en **Guardar**

## ¿Cómo enviar un documento con firma dual?

1. Ir a **Firma Electrónica** → **Enviar**
2. Seleccionar el **trabajador** y el **documento**
3. ☐ Marcar **"Requiere firma de la empresa"**
4. Aparece el preview del representante legal con su nombre y correo
5. Si el representante no está configurado, verás un error → agrégalo en Configuración primero
6. Click en **Enviar a firma**

## ¿Qué pasa después?

```
📧 Trabajador recibe link        📧 Rep legal recibe link
   (por correo al trab)            (por correo al rep)
        ↓                                ↓
   Identifica con CC                Identifica con SU CC
        ↓                                ↓
   OTP al correo                    OTP al correo
        ↓                                ↓
   Lee, acepta, firma              Lee, acepta, firma
                                        ↓
                              🎉 Documento DUAL_FIRMADO
```

- El **trabajador** firma primero (su firma es la 1ª)
- **Automáticamente** el sistema le envía el link al representante
- El **representante** abre el link, se identifica, y firma (su firma es la 2ª)
- El PDF final tiene las 2 firmas visibles
- Estado: `DUAL_FIRMADO ✓`

## ¿Y si el representante no firma?

- El documento queda con **1 firma** (solo del trabajador)
- Después de **72 horas** el link del representante expira
- Puedes reenviar manualmente (próximamente: opción de reintento automático)

## ¿Y si me equivoqué al enviar?

- El documento del trabajador ya está firmado — no se puede deshacer
- El link del representante aún no se creó (solo se crea cuando el worker firma)
- Si todavía no has hecho click en "Enviar a firma", puedes desmarcar el checkbox y enviar solo con la firma del trabajador

## Tabla resumen

| Acción | Quién | Cuándo |
|---|---|---|
| Firmar documento | Trabajador | Primero |
| Firmar documento | Representante legal | Después (automático) |
| Configurar representante | Administrador | Una vez por empresa |
| Revisar el PDF final | Cualquiera | Después de las 2 firmas |

## Estados del documento

- **PENDING**: creado, sin abrir link
- **FIRMA_TRABAJADOR_OK**: el trabajador ya firmó, falta la empresa
- **DUAL_FIRMADO**: las 2 firmas están ✓
- **REJECTED**: alguien rechazó firmar
- **EXPIRED**: pasó el tiempo y no se completó

## ¿Necesitas ayuda?

Contacta al área de soporte de K+AIR.

---

*Esta guía se entrega con la versión 0.1.180. Si tienes dudas sobre una pantalla específica, contacta al equipo técnico.*
