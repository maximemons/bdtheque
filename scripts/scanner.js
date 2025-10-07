let scannerstartBtn;
let scannerstopBtn;
let scannervideo;
let scanneroverlay;
let scannerresultArea;

let scannerfctOnClose = undefined;

let codeReader = null; // instance ZXing

function initiateScanner(startBtnId, stopBtnId, videoId, overlayId, resultAreaId, fctOnClose) {
	scannerstartBtn = document.getElementById(startBtnId);
	scannerstopBtn = document.getElementById(stopBtnId);
	scannervideo = document.getElementById(videoId);
	scanneroverlay = document.getElementById(overlayId);
	scannerresultArea = document.getElementById(resultAreaId);

	if(fctOnClose != undefined)
		scannerfctOnClose = fctOnClose;

	scannerstartBtn.addEventListener('click', () => {startScanner();});
	scannerstopBtn.addEventListener('click', () => {stopScanner(true);});

	scannervideo.addEventListener('loadedmetadata', fitOverlay);
	window.addEventListener('resize', fitOverlay);
}

// Ajuste le canvas overlay à la taille de la vidéo
function fitOverlay() {
	scanneroverlay.width = scannervideo.videoWidth || scannervideo.clientWidth;
	scanneroverlay.height = scannervideo.videoHeight || scannervideo.clientHeight;
	scanneroverlay.style.width = scannervideo.clientWidth + 'px';
	scanneroverlay.style.height = scannervideo.clientHeight + 'px';
}

// Dessine la boîte autour du code détecté
function drawResultPoints(points) {
	const ctx = scanneroverlay.getContext('2d');
	ctx.clearRect(0, 0, scanneroverlay.width, scanneroverlay.height);
	if (!points || points.length === 0) return;
	ctx.lineWidth = Math.max(2, scanneroverlay.width * 0.005);
	ctx.strokeStyle = 'lime';
	ctx.beginPath();
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const x = p.x;
		const y = p.y;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.stroke();
	ctx.fillStyle = 'rgba(0,255,0,0.15)';
	ctx.fill();
}

async function startScanner() {
	document.getElementById("modal").style.display = 'block';
	// Vérifie que la lib est chargée
	if (typeof ZXing === 'undefined' && typeof window.ZXing === 'undefined') {
		alert('La bibliothèque ZXing n\'a pas pu être chargée. Assurez-vous d\'être connecté à internet ou d\'avoir la lib localement.');
		document.getElementById("modal").style.display = 'none';
		return;
	}

	// Création du lecteur (gère plusieurs formats : EAN, CODE_128, UPC, etc.)
	codeReader = new ZXing.BrowserMultiFormatReader();

	scannerstartBtn.disabled = true;

	try {
		// Utilise directement la caméra par défaut
		await codeReader.decodeFromVideoDevice(null, 'video', (result, err) => {
			fitOverlay();
			if (result) {
				scannerresultArea.value = result.getText();
				stopScanner(true);
				try {
					const points = result.getResultPoints ? result.getResultPoints() : (result.resultPoints || []);
					drawResultPoints(points);
				} catch (e) {}
			}
			if (err && !(err instanceof ZXing.NotFoundException)) {
				console.debug('ZXing err', err);
				document.getElementById("modal").style.display = 'none';
			}
		});

		scannerstopBtn.disabled = false;
	} catch (e) {
		console.error(e);
		alert('Impossible d\'accéder à la caméra : ' + (e && e.message ? e.message : e));
		document.getElementById("modal").style.display = 'none';
		scannerstartBtn.disabled = false;
	}
}

function stopScanner(fctAfterClose) {	
	if (codeReader) {
		try {
			codeReader.reset();
		} catch (e) {}
		codeReader = null;
	}
	if (scannervideo && scannervideo.srcObject) {
		const tracks = scannervideo.srcObject.getTracks();
		tracks.forEach(t => t.stop());
		scannervideo.srcObject = null;
	}
	const ctx = scanneroverlay.getContext('2d');
	ctx && ctx.clearRect(0, 0, scanneroverlay.width, scanneroverlay.height);

	scannerstartBtn.disabled = false;
	scannerstopBtn.disabled = true;
	document.getElementById("modal").style.display = 'none';
	
	if(fctAfterClose && scannerfctOnClose != undefined)
		scannerfctOnClose();
}