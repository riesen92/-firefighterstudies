// Al inicio del archivo, organizamos las preguntas por lecciones
let questionSets = {};

// Función para cargar las preguntas de una lección
async function loadLeccionQuestions(leccionNumber) {
    try {
        const response = await fetch(`data/leccion${leccionNumber}.json`);
        const data = await response.json();
        return data.preguntas;
    } catch (error) {
        console.error(`Error cargando lección ${leccionNumber}:`, error);
        return [];
    }
}

// Función para cargar todas las lecciones al inicio
async function initializeQuestions() {
    // Cargar cada lección
    for (let i = 1; i <= 10; i++) {
        questionSets[`leccion${i}`] = await loadLeccionQuestions(i);
    }
    
    // Para el test final, usar todas las preguntas
    questionSets.final = Object.values(questionSets)
        .flat()
        .sort(() => Math.random() - 0.5);
}

// Función auxiliar para obtener preguntas aleatorias
function getRandomQuestions(questions, count) {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, questions.length));
}

let currentQuestionSet = [];
// Variables globales necesarias
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let timer;
let timeLeft = 60;

// Función para iniciar el test
async function startTest(testType) {
    try {
        if (testType === 'final') {
            let finalQuestions = [];
            
            // Cargar 6 preguntas aleatorias de cada lección (10 lecciones x 6 preguntas = 60 total)
            for (let i = 1; i <= 10; i++) {
                try {
                    const response = await fetch(`data/leccion${i}.json`);
                    if (!response.ok) {
                        throw new Error(`Error cargando lección ${i}`);
                    }
                    const data = await response.json();
                    // Obtener 6 preguntas aleatorias de cada lección
                    const randomQuestions = getRandomQuestions(data.preguntas, 6);
                    finalQuestions = finalQuestions.concat(randomQuestions);
                } catch (error) {
                    console.error(`Error cargando lección ${i}:`, error);
                }
            }
            
            if (finalQuestions.length === 0) {
                throw new Error('No se pudieron cargar las preguntas');
            }

            // Mezclar el orden final de todas las preguntas
            currentQuestionSet = finalQuestions.sort(() => Math.random() - 0.5);
            document.getElementById('test-title').textContent = 'Evaluación Final';
        } else {
            const response = await fetch(`data/${testType}.json`);
            if (!response.ok) {
                throw new Error('Error cargando el archivo');
            }
            const data = await response.json();
            currentQuestionSet = data.preguntas;
            document.getElementById('test-title').textContent = 
                `Lección ${testType.replace('leccion', '')}`;
        }

        // Ocultar menú y mostrar quiz
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('quiz-section').style.display = 'block';
        
        currentQuestionIndex = 0;
        score = 0;
        userAnswers = [];
        
        loadQuestion();
    } catch (error) {
        console.error('Error cargando las preguntas:', error);
        alert('Error cargando las preguntas. Por favor, inténtalo de nuevo.');
        returnToMenu();
    }
}

// Función para volver al menú
function returnToMenu() {
    clearInterval(timer);
    document.getElementById('quiz-section').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    
    // Limpiar estados
    document.getElementById("result").innerText = "";
    document.getElementById("review-container").innerHTML = "";
    document.getElementById("review-container").style.display = "none";
    document.getElementById("restart-btn-container").style.display = "none";
    document.getElementById("review-btn-container").style.display = "none";
    document.getElementById("next-btn-container").style.display = "flex";
    document.getElementById('progress-bar').style.width = '0%';
    
    // Actualizar estilos de los botones
    updateMenuButtonsStyle(); // Actualizar estilos al volver al menú
}

// Función para el temporizador
function startTimer() {
    clearInterval(timer);
    timeLeft = 60;
    
    const timerDisplay = document.getElementById('timer');
    timerDisplay.textContent = timeLeft;
    timerDisplay.className = '';
    
    timer = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        
        if (timeLeft <= 10) {
            timerDisplay.className = 'warning';
        }
        
        if (timeLeft <= 5) {
            timerDisplay.className = 'danger';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            blockCurrentQuestion();
            nextQuestion();
        }
    }, 1000);
}

// Función para bloquear la pregunta actual cuando se acaba el tiempo
function blockCurrentQuestion() {
    userAnswers[currentQuestionIndex] = {
        answered: false,
        blocked: true
    };
}

// Función para actualizar la barra de progreso
function updateProgressBar() {
    const progress = ((currentQuestionIndex + 1) / currentQuestionSet.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
}

// Función para crear los números de pregunta
function createQuestionNumbers() {
    const numbersContainer = document.getElementById('question-numbers');
    numbersContainer.innerHTML = '';
    
    for (let i = 0; i < currentQuestionSet.length; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.className = `number-circle ${i === currentQuestionIndex ? 'active' : ''}`;
        if (userAnswers[i]) {
            if (userAnswers[i].blocked) {
                numberDiv.className += ' blocked';
            } else if (userAnswers[i].selected === currentQuestionSet[i].answer) {
                numberDiv.className += ' correct';
            } else {
                numberDiv.className += ' incorrect';
            }
        }
        numberDiv.textContent = i + 1;
        numbersContainer.appendChild(numberDiv);
    }
}

// Función para pasar a la siguiente pregunta
function nextQuestion() {
    const selectedOption = document.querySelector('input[name="answer"]:checked');
    
    if (!selectedOption && !userAnswers[currentQuestionIndex]?.blocked) {
        alert("Por favor selecciona una respuesta");
        return;
    }
    
    if (!userAnswers[currentQuestionIndex]?.blocked) {
        userAnswers[currentQuestionIndex] = {
            selected: selectedOption.value,
            answered: true
        };
    }
    
    currentQuestionIndex++;
    
    if (currentQuestionIndex < currentQuestionSet.length) {
        loadQuestion();
    } else {
        showResults();
    }
}

// Función para reiniciar el quiz
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

// Función para resetear completamente el quiz
function resetQuiz() {
    if (confirm('¿Estás seguro que deseas empezar desde cero? Se perderá todo el progreso.')) {
        returnToMenu();
    }
}

// Función para guardar el progreso
function saveProgress() {
    const progress = {
        currentQuestionIndex,
        score,
        userAnswers,
        currentQuestionSet
    };
    localStorage.setItem('quizProgress', JSON.stringify(progress));
}

// Función para cargar el progreso guardado
function loadSavedProgress() {
    const savedProgress = localStorage.getItem('quizProgress');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        currentQuestionIndex = progress.currentQuestionIndex;
        score = progress.score;
        userAnswers = progress.userAnswers;
        currentQuestionSet = progress.currentQuestionSet;
        return true;
    }
    return false;
}

// Función para limpiar el progreso guardado
function clearSavedProgress() {
    localStorage.removeItem('quizProgress');
}

// Función para cargar la pregunta
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
                .map(option => `
                    <label ${previousAnswer?.blocked ? 'class="blocked"' : ''}>
                        <input type="radio" 
                               name="answer" 
                               value="${option}"
                               ${previousAnswer?.blocked ? 'disabled' : ''}
                               ${previousAnswer && previousAnswer.selected === option ? 'checked' : ''}> 
                        ${option}
                    </label>
                `).join("")}
        </div>
        ${previousAnswer?.blocked ? '<div class="blocked-message">Tiempo agotado - Pregunta bloqueada</div>' : ''}
    `;
    updateProgressBar();
    startTimer();
    createQuestionNumbers();
}

// Actualizar otras funciones que usan 'questions' para usar 'currentQuestionSet'
// Por ejemplo, en showResults():
function showResults() {
    clearSavedProgress();
    
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
    
    // Guardar la nota usando el título completo de la lección
    const testTitle = document.getElementById('test-title').textContent;
    sessionStorage.setItem(testTitle, finalScore.toFixed(1));
    
    // Mostrar resultados
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
    updateMenuButtonsStyle(); // Actualizar los estilos inmediatamente
}

function reviewAnswers() {
    const reviewContainer = document.getElementById('review-container');
    reviewContainer.style.display = 'block';
    reviewContainer.innerHTML = '';

    currentQuestionSet.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer?.selected === question.answer;
        
        const reviewHtml = `
            <div class="review-question ${isCorrect ? 'correct' : 'incorrect'}">
                <h3>Pregunta ${index + 1}</h3>
                <p>${question.question}</p>
                <div class="options-review">
                    ${question.options.map(option => `
                        <div class="option ${option === question.answer ? 'correct-answer' : ''} 
                                         ${option === userAnswer?.selected && option !== question.answer ? 'wrong-answer' : ''}">
                            ${option === question.answer ? '✅' : option === userAnswer?.selected ? '❌' : ''}
                            ${option}
                        </div>
                    `).join('')}
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

function updateMenuButtonsStyle() {
    const menuButtons = document.querySelectorAll('.menu-btn:not(.final-test)');
    menuButtons.forEach(button => {
        const buttonText = button.textContent.trim();
        const score = sessionStorage.getItem(buttonText);
        
        if (score) {
            button.classList.add('completed');
            // Asegurarse de que no dupliquemos el badge si ya existe
            if (!button.querySelector('.score-badge')) {
                button.innerHTML = `
                    ${buttonText}
                    <span class="score-badge">${score}</span>
                `;
            }
        }
    });
    
    // Para depuración
    console.log('Contenido actual del sessionStorage:');
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        console.log(`${key}: ${sessionStorage.getItem(key)}`);
    }
}

// Llamar a updateMenuButtonsStyle después de volver al menú
function returnToMenu() {
    clearInterval(timer);
    document.getElementById('quiz-section').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
    
    // Limpiar estados
    document.getElementById("result").innerText = "";
    document.getElementById("review-container").innerHTML = "";
    document.getElementById("review-container").style.display = "none";
    document.getElementById("restart-btn-container").style.display = "none";
    document.getElementById("review-btn-container").style.display = "none";
    document.getElementById("next-btn-container").style.display = "flex";
    document.getElementById('progress-bar').style.width = '0%';
    
    // Actualizar estilos de los botones
    updateMenuButtonsStyle(); // Actualizar estilos al volver al menú
}

// Llamar cuando se carga la página
window.addEventListener('DOMContentLoaded', () => {
    updateMenuButtonsStyle();
    // Mostrar contenido del sessionStorage para depuración
    debugSessionStorage();
});

function debugSessionStorage() {
    console.log('Contenido del sessionStorage:');
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        console.log(`${key}: ${sessionStorage.getItem(key)}`);
    }
}