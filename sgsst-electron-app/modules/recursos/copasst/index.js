/**
* Submódulo Copasst
*
* Este archivo exporta las funcionalidades del submódulo Copasst
*/

const copasstLogic = require('./copasst-logic');
const copasstViewer = require('./copasst-viewer');
const copasstPortalLogic = require('./copasst-portal-logic');

module.exports = {
logic: copasstLogic,
viewer: copasstViewer,
portal: copasstPortalLogic,
render: (container, context) => {
if (copasstViewer && typeof copasstViewer.render === 'function') {
copasstViewer.render(container, context);
} else {
console.error('El viewer del submódulo copasst no tiene un método render');
}
}
};