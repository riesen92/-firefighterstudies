/*************************************
 * Configuración de cursos por carpeta
 *************************************/
const COURSES = {
  controlincendios: {
    title: "Control de Incendios",
    lessons: ["leccion1", "leccion2", "leccion3", "leccion4", "leccion5"],
    finalQuestionsPerLesson: 6 // (opcional; ya no se usa para "final")
  },
  busquedayrescate: {
    title: "Búsqueda y Rescate",
    lessons: ["leccion1", "leccion2", "leccion3"], // ajusta según tus archivos
    finalQuestionsPerLesson: 6 // (opcional; ya no se usa para "final")
  },
  riesgosElectricos: {
    title: "Riesgos Eléctricos",
    lessons: ["leccion1", "leccion2"], // ajusta según tus archivos
    finalQuestionsPerLesson: 6 // (opcional; ya no se usa para "final")
  }
};

// Utilidad: construir la ruta al JSON de una lección
function lessonPath(course, lesson) {
  return `data/${course}/${lesson}.json`;
}

// Utilidad: barajar arreglo
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Utilidad: tomar N aleatorias
function takeRandom(arr, n) {
  const s = shuffle(arr);
  return s.slice(0, Math.min(n, s.length));
}

/*************************************
 * Estado del quiz
 *************************************/
let currentQuestionSet = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let timer;
let timeLeft = 60;
const TOTAL_FINAL_QUESTIONS = 30;

/*************************************
 * Carga de preguntas
 *************************************/
async function loadLessonQuestions(course, lesson) {
  try {
    const res = await fetch(lessonPath(course, lesson));
    if (!res.ok) throw new Error(`No se pudo cargar ${course}/${lesson}`);
    const data = await res.json();
    return data.preguntas || [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

/*************************************
 * Iniciar test
 * Acepta paths tipo:
 *  - "controlincendios/leccion1"
 *  - "controlincendios/final"
 * También mantiene compatibilidad simple con "leccionX" plano
 *************************************/
async function startTest(testType) {
  try {
    // Caso nuevo: "curso/archivo"
    if (testType.includes("/")) {
      const [course, file] = testType.split("/");
      const courseCfg = COURSES[course];
      if (!courseCfg) throw new Error(`Curso no definido: ${course}`);

      if (file.toLowerCase() === "final") {
        // Final por curso: SIEMPRE 30 preguntas distribuidas entre sus lecciones
        currentQuestionSet = await buildCourseFinalQuestions(course, TOTAL_FINAL_QUESTIONS);
        document.getElementById("test-title").textContent = `Evaluación Final — ${courseCfg.title}`;
      } else {
        // Lección específica del curso
        currentQuestionSet = await loadLessonQuestions(course, file);
        const niceName = file.replace("leccion", "Lección ");
        document.getElementById("test-title").textContent = `${niceName} — ${courseCfg.title}`;
      }
    } else {
      // Compatibilidad con llamadas antiguas: "leccion1", "final" plano
      if (testType === "final") {
        // Mezcla TODAS las preguntas de TODOS los cursos y toma 30
        let pool = [];
        for (const key of Object.keys(COURSES)) {
          const cfg = COURSES[key];
          for (const lesson of cfg.lessons) {
            const qs = await loadLessonQuestions(key, lesson);
            pool = pool.concat(qs);
          }
        }
        currentQuestionSet = takeRandom(pool, TOTAL_FINAL_QUESTIONS);
        document.getElementById("test-title").textContent = "Evaluación Final — Todos los cursos";
      } else if (testType.startsWith("leccion")) {
        // Mapear a la PRIMERA coincidencia de curso que tenga esa lección
        let loaded = false;
        for (const [course, cfg] of Object.entries(COURSES)) {
          if (cfg.lessons.includes(testType)) {
            currentQuestionSet = await loadLessonQuestions(course, testType);
            document.getElementById("test-title").textContent =
              `${testType.replace("leccion", "Lección ")} — ${cfg.title}`;
            loaded = true;
            break;
          }
        }
        if (!loaded) throw new Error(`No se encontró ${testType} en ningún curso`);
      } else {
        throw new Error(`testType no soportado: ${testType}`);
      }
    }

    // Mostrar UI de quiz
    document.getElementById("main-menu").style.display = "none";
    document.querySelectorAll(".submenu").forEach(s => (s.style.display = "none"));
    document.getElementById("quiz-section").style.display = "block";

    // Reset de estado
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];

    loadQuestion();
  } catch (error) {
    console.error("Error cargando las preguntas:", error);
    alert("Error cargando las preguntas. Revisa la ruta o los archivos del curso.");
    returnToMenu();
  }
}

/*************************************
 * Navegación de menús (cursos → submenús)
 *************************************/
function openCourse(courseId) {
  document.getElementById("main-menu").style.display = "none";
  document.querySelectorAll(".submenu").forEach(menu => (menu.style.display = "none"));
  const target = document.getElementById(courseId);
  if (target) target.style.display = "block";
}

function returnToMainMenu() {
  document.querySelectorAll(".submenu").forEach(menu => (menu.style.display = "none"));
  document.getElementById("main-menu").style.display = "block";
}

// Volver desde el quiz al menú principal de cursos
function returnToMenu() {
  clearInterval(timer);
  document.getElementById("quiz-section").style.display = "none";
  document.querySelectorAll(".submenu").forEach(s => (s.style.display = "none"));
  document.getElementById("main-menu").style.display = "block";

  // Limpiar estados UI
  document.getElementById("result").innerText = "";
  document.getElementById("review-container").innerHTML = "";
  document.getElementById("review-container").style.display = "none";
  document.getElementById("restart-btn-container").style.display = "none";
  document.getElementById("review-btn-container").style.display = "none";
  document.getElementById("next-btn-container").style.display = "flex";
  document.getElementById("progress-bar").style.width = "0%";

  updateMenuButtonsStyle();
}

/*************************************
 * Timer
 *************************************/
function startTimer() {
  clearInterval(timer);
  timeLeft = 60;

  const timerDisplay = document.getElementById("timer");
  timerDisplay.textContent = timeLeft;
  timerDisplay.className = "";

  timer = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;

    if (timeLeft <= 10) timerDisplay.className = "warning";
    if (timeLeft <= 5) timerDisplay.className = "danger";

    if (timeLeft <= 0) {
      clearInterval(timer);
      blockCurrentQuestion();
      nextQuestion();
    }
  }, 1000);
}

function blockCurrentQuestion() {
  userAnswers[currentQuestionIndex] = { answered: false, blocked: true };
}

/*************************************
 * UI: progreso, numeración, carga de pregunta
 *************************************/
function updateProgressBar() {
  const progress = ((currentQuestionIndex + 1) / currentQuestionSet.length) * 100;
  document.getElementById("progress-bar").style.width = `${progress}%`;
}

function createQuestionNumbers() {
  const numbersContainer = document.getElementById("question-numbers");
  numbersContainer.innerHTML = "";

  for (let i = 0; i < currentQuestionSet.length; i++) {
    const numberDiv = document.createElement("div");
    numberDiv.className = `number-circle ${i === currentQuestionIndex ? "active" : ""}`;
    if (userAnswers[i]) {
      if (userAnswers[i].blocked) {
        numberDiv.className += " blocked";
      } else if (userAnswers[i].selected === currentQuestionSet[i].answer) {
        numberDiv.className += " correct";
      } else {
        numberDiv.className += " incorrect";
      }
    }
    numberDiv.textContent = i + 1;
    numbersContainer.appendChild(numberDiv);
  }
}

function loadQuestion() {
  document.getElementById("question-counter").textContent =
    `Pregunta ${currentQuestionIndex + 1} de ${currentQuestionSet.length}`;

  const questionContainer = document.getElementById("question-container");
  const currentQuestion = currentQuestionSet[currentQuestionIndex];
  const previousAnswer = userAnswers[currentQuestionIndex];

  questionContainer.innerHTML = `
    <div class="question">${currentQuestion.question}</div>
    <div class="options">
      ${currentQuestion.options
        .map(
          option => `
        <label ${previousAnswer?.blocked ? 'class="blocked"' : ""}>
          <input
            type="radio"
            name="answer"
            value="${option}"
            ${previousAnswer?.blocked ? "disabled" : ""}
            ${previousAnswer && previousAnswer.selected === option ? "checked" : ""}>
          ${option}
        </label>`
        )
        .join("")}
    </div>
    ${previousAnswer?.blocked ? '<div class="blocked-message">Tiempo agotado - Pregunta bloqueada</div>' : ""}
  `;
  updateProgressBar();
  startTimer();
  createQuestionNumbers();
}

/*************************************
 * Navegación de preguntas / resultados / revisión
 *************************************/
function nextQuestion() {
  const selectedOption = document.querySelector('input[name="answer"]:checked');

  if (!selectedOption && !userAnswers[currentQuestionIndex]?.blocked) {
    alert("Por favor selecciona una respuesta");
    return;
  }

  if (!userAnswers[currentQuestionIndex]?.blocked) {
    userAnswers[currentQuestionIndex] = { selected: selectedOption.value, answered: true };
  }

  currentQuestionIndex++;

  if (currentQuestionIndex < currentQuestionSet.length) {
    loadQuestion();
  } else {
    showResults();
  }
}

function restartQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];
  document.getElementById("review-container").style.display = "none";
  document.getElementById("restart-btn-container").style.display = "none";
  document.getElementById("review-btn-container").style.display = "none";
  document.getElementById("next-btn-container").style.display = "flex";
  document.getElementById("result").innerHTML = "";
  loadQuestion();
}

function resetQuiz() {
  if (confirm("¿Estás seguro que deseas empezar desde cero? Se perderá todo el progreso.")) {
    returnToMenu();
  }
}

function showResults() {
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  let notAnswered = 0;

  for (let i = 0; i < currentQuestionSet.length; i++) {
    const answer = userAnswers[i];
    if (!answer || !answer.answered) {
      notAnswered++;
    } else if (answer.selected === currentQuestionSet[i].answer) {
      correctAnswers++;
    } else {
      incorrectAnswers++;
    }
  }

  let finalScore = (correctAnswers / currentQuestionSet.length) * 6 + 1;
  let resultText = finalScore >= 4.0 ? "¡Aprobaste! 🎉" : "Reprobaste 😞";

  const testTitle = document.getElementById("test-title").textContent;
  sessionStorage.setItem(testTitle, finalScore.toFixed(1));

  document.getElementById("question-container").innerHTML = "";
  document.getElementById("result").innerHTML = `
    ${resultText}<br>
    Nota final: ${finalScore.toFixed(1)}<br>
    Total preguntas: ${currentQuestionSet.length}<br>
    Correctas: ${correctAnswers}<br>
    Incorrectas: ${incorrectAnswers}<br>
    Sin responder: ${notAnswered}
  `;

  document.getElementById("next-btn-container").style.display = "none";
  document.getElementById("review-btn-container").style.display = "flex";

  createQuestionNumbers();
  updateMenuButtonsStyle(); // mantiene badges en botones del menú
}

/*************************************
 * Helper: construir final por curso con 30 preguntas
 *************************************/
async function buildCourseFinalQuestions(courseKey, total = TOTAL_FINAL_QUESTIONS) {
  const courseCfg = COURSES[courseKey];
  if (!courseCfg) throw new Error(`Curso no definido: ${courseKey}`);

  // 1) Cargar todas las preguntas por lección
  const lessons = courseCfg.lessons;
  const lessonQuestions = [];
  for (const lesson of lessons) {
    const qs = await loadLessonQuestions(courseKey, lesson);
    lessonQuestions.push({ lesson, qs });
  }

  // 2) Reparto equitativo base + resto (p. ej., 30 entre 5 lecciones = 6 c/u)
  const base = Math.floor(total / lessons.length);
  let remainder = total % lessons.length;

  // 3) Tomar de cada lección hasta su cupo (o hasta donde alcance)
  let picked = [];
  for (let i = 0; i < lessonQuestions.length; i++) {
    const { qs } = lessonQuestions[i];
    const allocation = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    const take = Math.min(allocation, qs.length);
    picked = picked.concat(takeRandom(qs, take));
  }

  // 4) Si faltan preguntas para llegar al total, rellenar desde el pool global restante
  if (picked.length < total) {
    const allRemaining = [];
    for (const { qs } of lessonQuestions) {
      const remaining = qs.filter(q => !picked.includes(q));
      allRemaining.push(...remaining);
    }
    const stillNeed = total - picked.length;
    picked = picked.concat(takeRandom(allRemaining, Math.min(stillNeed, allRemaining.length)));
  }

  // 5) Barajar y recortar por si acaso
  return shuffle(picked).slice(0, total);
}

/*************************************
 * Revisión de respuestas
 *************************************/
function reviewAnswers() {
  const reviewContainer = document.getElementById("review-container");
  reviewContainer.style.display = "block";
  reviewContainer.innerHTML = "";

  currentQuestionSet.forEach((question, index) => {
    const userAnswer = userAnswers[index];
    const isCorrect = userAnswer?.selected === question.answer;

    const reviewHtml = `
      <div class="review-question ${isCorrect ? "correct" : "incorrect"}">
        <h3>Pregunta ${index + 1}</h3>
        <p>${question.question}</p>
        <div class="options-review">
          ${question.options
            .map(
              option => `
            <div class="option ${option === question.answer ? "correct-answer" : ""} 
                             ${option === userAnswer?.selected && option !== question.answer ? "wrong-answer" : ""}">
              ${option === question.answer ? "✅" : option === userAnswer?.selected ? "❌" : ""}
              ${option}
            </div>`
            )
            .join("")}
        </div>
        <div class="explanation">
          <strong>Explicación:</strong>
          <p>${question.explanation}</p>
        </div>
      </div>
    `;
    reviewContainer.innerHTML += reviewHtml;
  });
}

/*************************************
 * Badges de notas en botones del menú (igual que antes)
 *************************************/
function updateMenuButtonsStyle() {
  const menuButtons = document.querySelectorAll(".menu-btn:not(.final-test)");
  menuButtons.forEach(button => {
    const buttonText = button.textContent.trim();
    const score = sessionStorage.getItem(buttonText);
    if (score) {
      button.classList.add("completed");
      if (!button.querySelector(".score-badge")) {
        button.innerHTML = `
          ${buttonText}
          <span class="score-badge">${score}</span>
        `;
      }
    }
  });
}

/*************************************
 * Arranque
 *************************************/
window.addEventListener("DOMContentLoaded", () => {
  updateMenuButtonsStyle();
});
