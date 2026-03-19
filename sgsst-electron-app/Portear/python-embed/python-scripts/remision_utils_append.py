# Funciones principales que se llaman desde Electron
def generate_remision_document(data, empresa):
    """
    Genera un documento de remisión a partir de los datos extraídos.
    """
    try:
        log(f"Iniciando generación de documento para la empresa: {empresa}")
        doc_generator = DocumentGenerator()
        excel_handler = ExcelHandler()
        
        empresa_rutas = Config.get_empresa_paths(empresa)
        log(f"Rutas obtenidas para {empresa}: {empresa_rutas}")
        
        template_path = empresa_rutas["plantilla"]
        output_dir = empresa_rutas["remisiones"]
        
        log(f"Usando plantilla: {template_path}")
        doc_path = doc_generator.generate_remision(data, template_path, output_dir)
        log(f"Documento de remisión generado en: {doc_path}")
        
        control_path = empresa_rutas["control"]
        log(f"Actualizando archivo de control: {control_path}")
        excel_path = excel_handler.update_control_file(data, control_path)
        log(f"Archivo de control actualizado en: {excel_path}")
        
        return {
            "success": True,
            "documentPath": doc_path,
            "controlPath": excel_path
        }
    except Exception as e:
        log(f"Error al generar documento de remisión: {str(e)}", level='ERROR')
        return {
            "success": False,
            "error": str(e)
        }

def send_remision_by_email(doc_path, data, empresa):
    """
    Envía un documento de remisión por correo electrónico.
    """
    try:
        log(f"Iniciando envío de email para la empresa {empresa} con el documento {doc_path}")
        email_sender = EmailSender(empresa)
        
        cedula = data.get('No. Identificación', '')
        nombre = data.get('Nombre Completo', 'Trabajador')
        fecha_atencion = data.get('Fecha de Atención', '')
        
        if not cedula:
            raise ValueError("No se encontró el número de identificación en los datos para el email")
            
        contacto = email_sender.obtener_contacto(cedula)
        destinatario = contacto.get('email', '')
        
        if not destinatario:
            raise ValueError("No se encontró la dirección de correo para el destinatario")
            
        success = email_sender.enviar_correo(destinatario, nombre, fecha_atencion, doc_path)
        
        if success:
            log(f"Documento enviado exitosamente por email a {destinatario}")
            return {
                "success": True,
                "message": "Documento enviado exitosamente por email"
            }
        else:
            log("Error al enviar el documento por email", level='ERROR')
            return {
                "success": False,
                "error": "Error al enviar el documento por email"
            }
    except Exception as e:
        log(f"Error al enviar documento por email: {str(e)}", level='ERROR')
        return {
            "success": False,
            "error": str(e)
        }

def send_remision_by_whatsapp(doc_path, data, empresa):
    """
    Prepara un documento de remisión para enviar por WhatsApp.
    """
    try:
        log(f"Iniciando preparación de documento para WhatsApp: {doc_path}")
        
        # En una implementación real, aquí se prepararía el documento para enviar por WhatsApp
        # Por ahora, solo devolvemos la ruta del documento
        if os.path.exists(doc_path):
            log(f"Documento preparado para WhatsApp: {doc_path}")
            return {
                "success": True,
                "documentPath": doc_path,
                "message": "Documento preparado para enviar por WhatsApp"
            }
        else:
            log("Documento no encontrado para enviar por WhatsApp", level='ERROR')
            return {
                "success": False,
                "error": "Documento no encontrado"
            }
    except Exception as e:
        log(f"Error al preparar documento para WhatsApp: {str(e)}", level='ERROR')
        return {
            "success": False,
            "error": str(e)
        }


# Punto de entrada principal cuando se ejecuta como script
if __name__ == "__main__":
    # Redirigir el logger de Python a stdout para que Electron lo capture todo
    import logging
    import sys
    
    # Configurar logging para salida a stdout
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Limpiar handlers existentes
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
    
    # Agregar handler para stdout
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    root_logger.addHandler(stream_handler)

    if len(sys.argv) > 2:
        command = sys.argv[1]
        data_file = sys.argv[2]
        result = {}

        try:
            log(f"Comando '{command}' recibido con el archivo de datos: {data_file}")
            with open(data_file, 'r', encoding='utf-8') as f:
                temp_data = json.load(f)

            if command == "--generate-remision":
                result = generate_remision_document(temp_data['data'], temp_data['empresa'])
            elif command == "--send-email":
                result = send_remision_by_email(
                    temp_data['docPath'],
                    temp_data['data'],
                    temp_data['empresa']
                )
            elif command == "--send-whatsapp":
                result = send_remision_by_whatsapp(
                    temp_data['docPath'],
                    temp_data['data'],
                    temp_data['empresa']
                )
            else:
                result = {"success": False, "error": "Comando no reconocido"}

        except Exception as e:
            log(f"Error crítico en la ejecución del script: {str(e)}", level='ERROR')
            result = {"success": False, "error": str(e), "traceback": traceback.format_exc()}

        # Imprimir el resultado final
        final_output = {'type': 'result', 'payload': result}
        print(json.dumps(final_output, ensure_ascii=False))

    else:
        # Comportamiento normal de la aplicación GUI
        log("Iniciando en modo de interfaz gráfica (GUI).")
        # app = RemisionesApp()
        # app.mainloop()