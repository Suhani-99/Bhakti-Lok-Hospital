/* =========================================
   1. GLOBAL VARIABLES & DATA
   ========================================= */

// Doctor Data: Array of Objects
// REPLACE your existing 'const doctors' array with this:

const doctors = [
    {
        id: 1,
        name: "Dr. Mansi Shanghavi",
        specialization: "Gynecologist & Obstetrician",
        qualification: "MBBS, DGO",
        fee: 1000,
        description: "Empathetic gynecologist with 7 years of experience in healthcare. Specializing in obstetrics, pregnancy care, painless normal delivery, and women's health.",
        // Make sure you have this image in your folder
        image: "images/dr-mansi.png" 
    },
    {
        id: 2,
        name: "Dr. Amol Shah",
        specialization: "Homeopathy Doctor",
        qualification: "BHMS (M.U.H.S. Nasik, 2008)",
        fee: 500, // Placeholder fee
        description: "Homeopathy specialist with 17 years of experience. Also specializes in Dermatology & Cosmetology. Treats height issues, leg pain, and underweight disorders.",
        // Using a generic placeholder image since you don't have one
        image: "https://cdn-icons-png.flaticon.com/512/3774/3774299.png"
    }
];

// Booking State: Stores user selection
let bookingData = {
    patientDetails: {},
    selectedDoctor: null,
    date: null,
    timeSlot: null,
    fee: 200
};

/* =========================================
   2. DOM LOADED EVENT (Initializes Listeners)
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- NAVBAR LOGIC (Runs on ALL pages) ---
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        // Toggle the 'active' class on click
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        // Close menu when a link is clicked
        document.querySelectorAll('.nav-links li a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }

    // --- GALLERY PAGE SPECIFIC LOGIC ---
    // We only add this listener if the lightbox actually exists on the current page
    const lightbox = document.getElementById('gallery-lightbox');
    if (lightbox) {
        lightbox.addEventListener('click', function(e) {
            if (e.target !== document.getElementById('lightbox-img')) {
                closeLightbox();
            }
        });
    }

    // Console log to verify script is running
    console.log("Bhakti Lok Hospital Website Loaded");
});


/* =========================================
   3. GLOBAL FUNCTIONS (Called via HTML onclick)
   ========================================= */

// --- OPD / SERVICES FUNCTIONS ---

function startOPDFlow() {
    const menu = document.getElementById('service-menu');
    const flow = document.getElementById('opd-flow-container');
    
    if(menu && flow) {
        menu.style.display = 'none';
        flow.style.display = 'block';
        flow.scrollIntoView({behavior: 'smooth'});
    }
}

function handleFormSubmit(e) {
    e.preventDefault(); 
    bookingData.patientDetails = {
        name: document.getElementById('p_name').value,
        age: document.getElementById('p_age').value,
        contact: document.getElementById('p_contact').value,
        symptoms: document.getElementById('p_symptoms').value
    };

    document.getElementById('step-1-form').style.display = 'none';
    document.getElementById('step-2-doctors').style.display = 'block';
    renderDoctors();
}

function renderDoctors() {
    const grid = document.getElementById('doctor-grid');
    if (!grid) return;
    
    grid.innerHTML = ''; 

    doctors.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doc-card';
        card.onclick = () => showDoctorDetails(doc.id);
        card.innerHTML = `
            <img src="${doc.image}" alt="${doc.name}">
            <h4>${doc.name}</h4>
            <p>${doc.specialization}</p>
        `;
        grid.appendChild(card);
    });
}

let currentDocId = null;

function showDoctorDetails(id) {
    currentDocId = id;
    const doc = doctors.find(d => d.id === id);
    
    const modal = document.getElementById('doc-modal');
    if (modal) {
        document.getElementById('modal-img').src = doc.image;
        document.getElementById('modal-name').innerText = doc.name;
        document.getElementById('modal-spec').innerText = doc.specialization + ' | ' + doc.qualification;
        document.getElementById('modal-desc').innerText = doc.description;
        modal.style.display = 'flex';
    }
}

function closeModal() {
    const modal = document.getElementById('doc-modal');
    if (modal) modal.style.display = 'none';
}

function selectDoctorFromModal() {
    bookingData.selectedDoctor = doctors.find(d => d.id === currentDocId);
    closeModal();
    
    document.getElementById('step-2-doctors').style.display = 'none';
    document.getElementById('step-3-scheduler').style.display = 'block';
}

function loadTimeSlots() {
    const dateInput = document.getElementById('appointment-date').value;
    const slotContainer = document.getElementById('time-slots');
    
    if(!dateInput || !slotContainer) return;
    bookingData.date = dateInput;

    const slots = ["10:00 AM", "10:30 AM", "11:00 AM", "12:00 PM", "04:00 PM", "04:30 PM", "05:00 PM"];
    slotContainer.innerHTML = ''; 
    
    slots.forEach(time => {
        const btn = document.createElement('div');
        btn.className = 'time-slot';
        btn.innerText = time;
        btn.onclick = () => selectSlot(btn, time);
        slotContainer.appendChild(btn);
    });
}

function selectSlot(element, time) {
    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    bookingData.timeSlot = time;
    
    const btn = document.getElementById('confirm-slot-btn');
    if(btn) btn.disabled = false;
}

function goToSummary() {
    document.getElementById('step-3-scheduler').style.display = 'none';
    document.getElementById('step-4-summary').style.display = 'block';
    
    document.getElementById('sum-name').innerText = bookingData.patientDetails.name;
    document.getElementById('sum-symptoms').innerText = bookingData.patientDetails.symptoms;
    document.getElementById('sum-doc').innerText = bookingData.selectedDoctor.name;
    document.getElementById('sum-spec').innerText = bookingData.selectedDoctor.specialization;
    document.getElementById('sum-date').innerText = bookingData.date;
    document.getElementById('sum-time').innerText = bookingData.timeSlot;
}

function processPayment() {
    const btn = document.querySelector('#step-4-summary .btn-primary');
    btn.innerText = "Processing Payment...";
    btn.disabled = true;
    btn.style.backgroundColor = "#ccc";
    
    setTimeout(() => {
        document.getElementById('step-4-summary').style.display = 'none';
        document.getElementById('step-5-success').style.display = 'block';
        document.getElementById('trans-id').innerText = "TXN" + Math.floor(Math.random() * 10000000);
    }, 2000);
}

// --- GALLERY FUNCTIONS ---

function openLightbox(imgElement) {
    const lightbox = document.getElementById('gallery-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const captionText = document.getElementById('lightbox-caption');
    
    if (lightbox && lightboxImg) {
        lightbox.style.display = "flex"; 
        lightboxImg.src = imgElement.src;
        captionText.innerHTML = imgElement.alt; 
    }
}

function closeLightbox() {
    const lightbox = document.getElementById('gallery-lightbox');
    if (lightbox) lightbox.style.display = "none";
}

// --- CONTACT FUNCTIONS ---

function handleContactSubmit(e) {
    e.preventDefault(); 
    const name = document.getElementById('c_name').value;
    const email = document.getElementById('c_email').value;
    alert(`Thank you, ${name}! Your message has been sent to our support team. We will contact you at ${email} shortly.`);
    document.getElementById('contactForm').reset();
}