// test-module-cards.js - Componente de prueba para verificar el diseño de tarjetas de módulos

class TestModuleCards {
    constructor(container) {
        this.container = container;
    }

    render() {
        this.container.innerHTML = '';
        
        const title = document.createElement('h2');
        title.textContent = 'Prueba de Tarjetas de Módulos';
        this.container.appendChild(title);
        
        const description = document.createElement('p');
        description.textContent = 'Esta es una prueba para verificar que las tarjetas de módulos se muestren correctamente en dos columnas.';
        this.container.appendChild(description);
        
        // Crear contenedor de tarjetas
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';
        
        // Crear varias tarjetas de prueba
        for (let i = 1; i <= 6; i++) {
            const card = document.createElement('div');
            card.className = 'card module-card';
            
            const cardTitle = document.createElement('h3');
            cardTitle.className = 'card-title';
            cardTitle.textContent = `Submódulo ${i}`;
            card.appendChild(cardTitle);
            
            const cardDescription = document.createElement('p');
            cardDescription.className = 'card-description';
            cardDescription.textContent = `Descripción del submódulo ${i}. Esta es una prueba para verificar el diseño responsive de las tarjetas.`;
            card.appendChild(cardDescription);
            
            const cardButton = document.createElement('button');
            cardButton.className = 'btn btn-primary';
            cardButton.textContent = 'Abrir';
            cardButton.addEventListener('click', () => {
                alert(`Has hecho clic en el submódulo ${i}`);
            });
            card.appendChild(cardButton);
            
            cardsContainer.appendChild(card);
        }
        
        this.container.appendChild(cardsContainer);
    }
}

// Hacer la clase disponible globalmente
window.TestModuleCards = TestModuleCards;