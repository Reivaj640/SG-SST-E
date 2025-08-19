from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

try:
    # Configuración del modelo - ruta local
    model_path = r"D:\1. Estudio\1.1 IA\1.1.2. LLM's\Inv. AT\Unslot_mistral-7b-instruct-v0.2-bnb-4bit"
    
    # Configuración de BitsAndBytes para 4-bit
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    print("Cargando tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    
    print("Cargando modelo...")
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.float16
    )
    
    # Prueba interactiva
    while True:
        user_input = input("\nTú: ")
        if user_input.lower() in ["salir", "exit"]:
            break
            
        # Formato de prompt para Mistral instruct
        prompt = f"[INST] <<SYS>>\nEres un experto en seguridad laboral. Responde en español de manera clara y concisa.\n<</SYS>>\n\n{user_input} [/INST]"
        
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        outputs = model.generate(
            **inputs, 
            max_new_tokens=300, 
            temperature=0.7,
            pad_token_id=tokenizer.eos_token_id
        )
        # Decodificar la respuesta, omitiendo los tokens especiales
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extraer solo la parte de la respuesta del modelo (después de [/INST])
        ai_response = response.split("[/INST]")[-1].strip()
        print(f"\nAI: {ai_response}")

except Exception as e:
    print(f"Error: {str(e)}")