function showGestionIntegralHome() {
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = `
    <div class="main-content">
      <div class="header-container">
        <h2>Gestión Integral del SG-SST</h2>
      </div>
      <div class="card-container">
        <div class="card">
          <img src="assets/recursos.png" alt="Recursos">
          <h3>Recursos</h3>
          <p>Gestión de recursos para el SG-SST.</p>
          <button class="btn" onclick="showRecursosHome()">Acceder</button>
        </div>
        <div class="card">
          <img src="assets/gestion-salud.png" alt="Gestión de la Salud">
          <h3>Gestión de la Salud</h3>
          <p>Medicina preventiva y del trabajo.</p>
          <button class="btn" onclick="showGestionSaludHome()">Acceder</button>
        </div>
        <div class="card">
          <img src="assets/gestion-peligros.png" alt="Gestión de Peligros y Riesgos">
          <h3>Gestión de Peligros y Riesgos</h3>
          <p>Identificación y control de peligros.</p>
          <button class="btn" onclick="showGestionPeligrosHome()">Acceder</button>
        </div>
        <div class="card">
          <img src="assets/gestion-amenazas.png" alt="Gestión de Amenazas">
          <h3>Gestión de Amenazas</h3>
          <p>Prevención y preparación ante emergencias.</p>
          <button class="btn" onclick="showGestionAmenazasHome()">Acceder</button>
        </div>
        <div class="card">
          <img src="assets/verificacion.png" alt="Verificación">
          <h3>Verificación</h3>
          <p>Auditoría y revisión por la alta dirección.</p>
          <button class="btn" onclick="showVerificacionHome()">Acceder</button>
        </div>
        <div class="card">
          <img src="assets/mejoramiento.png" alt="Mejoramiento">
          <h3>Mejoramiento</h3>
          <p>Acciones preventivas y correctivas.</p>
          <button class="btn" onclick="showMejoramientoHome()">Acceder</button>
        </div>
      </div>
    </div>
  `;
}
