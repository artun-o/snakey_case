class GameController {
    #canvas;
    #context;

    #snakeX;
    #snakeY;

    #foodX;
    #foodY;
    
    //Board size is responsive
    #boardXMax;
    #boardYMax;

    #vector = { x: 0, y: 0 };
    #vectorDelta = 1;

    #trail = [];                                        //Snake X,Y positions will be maintained here (upto tailLength)
    #trailLength = GameController.minTrailLength;       //Snake tail will have a length of 5 initially

    //For notifying view about state changes
    #viewListener = null;

    //Constants
    static tileSize = 50;  //50px
    static minTrailLength = 3;

    static fieldColor = '#000000';
    static snakeColor = '#00ff00';
    static foodColor = '#ff0000';

    static iconOffsetX = 5;
    static iconOffsetY = 5;
    static iconSize = 40;

    static smoothFactor = 8;
    static foodIntersectionTolerance = 1;

    #SMOOTH = false;
    #currentState = null;

    playIcon = new Image();
    pauseIcon = new Image();
    smoothFPSIcon = new Image();

    static States = {
        RUNNING     :   'RUNNING',
        PAUSED      :   'PAUSED',
        GAME_OVER   :   'GAME_OVER'
    }

    //For preventing action on trying to move in opposite direction
    static oppositeKeyMapping = {
        37: 39,
        38: 40,
        39: 37,
        40: 38
    }

    resetSnake = () => {
        this.#snakeX = Math.floor(this.#boardXMax / 2);
        this.#snakeY = Math.floor(this.#boardYMax / 2);
    }

    placeFood = () => {
        this.#foodX = Math.floor(Math.random() * this.#boardXMax);
        this.#foodY = Math.floor(Math.random() * this.#boardYMax);

        //Avoiding placing at snake's current position
        if (this.isFoodInterSecting()) {
            this.placeFood();
        }
    }

    //Will update the canvas to set width and height and also update instance variables
    setUpCanvas = (innerWidth, innerHeight) => {
        this.#canvas.width = innerWidth;
        this.#canvas.height = innerHeight;

        this.#boardXMax = Math.floor(innerWidth / GameController.tileSize);
        this.#boardYMax = Math.floor(innerHeight / GameController.tileSize);
    }

    //For moving snake slower to allow 60FPS animation
    enableSmoothMode = () => {
        this.#SMOOTH = true;
        this.#vectorDelta /= GameController.smoothFactor;
        this.#vector.x /= GameController.smoothFactor;
        this.#vector.y /= GameController.smoothFactor;
    }

    //Reverting to 15FPS mode
    disableSmoothMode = () => {
        this.#SMOOTH = false;
        this.#vectorDelta *= GameController.smoothFactor;
        this.#vector.x *= GameController.smoothFactor;
        this.#vector.y *= GameController.smoothFactor;

        this.#snakeX = Math.round(this.#snakeX);
        this.#snakeY = Math.round(this.#snakeY);

        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];
            trailPos.x = Math.round(trailPos.x);
            trailPos.y = Math.round(trailPos.y);
        }
    }

    loadAssets = async () => {
        let images = [];
        images.push(this.playIcon);
        images.push(this.pauseIcon);
        images.push(this.smoothFPSIcon);

        let promiseChain = Promise.all(Array.from(images).filter(img => !img.complete).map(img => new Promise(resolve => { img.onload = img.onerror = resolve; })));
        promiseChain.then(() => { console.log('Assets loaded!'); });

        this.playIcon.src = 'assets/play-100.png';
        this.pauseIcon.src = 'assets/pause-100.png';
        this.smoothFPSIcon.src = 'assets/60-100.png';

        await promiseChain;
    }

    redrawUI = () => {
        let stateIcon = this.isPaused() ? this.playIcon : this.pauseIcon;
        this.#context.drawImage(stateIcon, GameController.iconOffsetX, GameController.iconOffsetY, GameController.iconSize, GameController.iconSize);

        this.#context.filter = 'opacity(' + (this.#SMOOTH ? 1 : 0.2) + ')';
        this.#context.drawImage(this.smoothFPSIcon, GameController.iconSize + GameController.iconOffsetX, GameController.iconOffsetY, GameController.iconSize, GameController.iconSize);
        this.#context.filter = 'none';

        let scoreText = 'Score: ' + this.#trailLength;
        this.#context.font = "20px Verdana";
        this.#context.fillStyle = '#FFFFFF';
        let textMetrics = this.#context.measureText(scoreText);
        this.#context.fillText(scoreText, this.#canvas.width - textMetrics.width - 10, 25);
    }

    //Main renderer
    looper = () => {
        if (this.isRunning()) {
            this.#snakeX += this.#vector.x;
            this.#snakeY += this.#vector.y;
        }
        
        this.handleWrap();
        
        //Draw field for entire canvas
        this.#context.fillStyle = GameController.fieldColor;
        this.#context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
        this.redrawUI();
        
        if (this.#trail.length == 0) {
            this.#trail.push({ x: this.#snakeX, y: this.#snakeY });
        }

        let isGameOver = false;
        this.#context.fillStyle = GameController.snakeColor;
        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];

            //Drawing snake and its tail. Params are for coordinates X, Y and rect size
            //-2 is added to show separation between tail element in the grid
            this.#context.fillRect(trailPos.x * GameController.tileSize, trailPos.y * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);

            const isTrailIntersecting = function() {
                return !this.#SMOOTH ? 
                            trailPos.x == this.#snakeX && trailPos.y == this.#snakeY :
                            Math.abs(trailPos.x - this.#snakeX) < this.getVectorDelta() / 2 && Math.abs(trailPos.y - this.#snakeY) < this.getVectorDelta() / 2;     //Allowing inaccurate match for when smooth mode is chosen;
            }.bind(this);

            //Oops, the snake bit itself :(
            if (isTrailIntersecting() && this.isRunning() && this.#trail.length > GameController.minTrailLength) {
                isGameOver = true;
            }
        }

        if (isGameOver) {
            this.handleGameOver();
        }

        //Adding current position to trail
        if (this.isRunning()) {
            this.#trail.unshift({ x: this.#snakeX, y: this.#snakeY });
            this.popExcessTrail();
        }

        //Snake has ate the food
        if (this.isFoodPosition(this.#snakeX, this.#snakeY, this.#SMOOTH)) {
            this.#trailLength++;
            this.placeFood();
        }

        this.#context.fillStyle = GameController.foodColor;
        //-2 on food rect as well for uniform size
        this.#context.fillRect(this.#foodX * GameController.tileSize, this.#foodY * GameController.tileSize, GameController.tileSize - 2, GameController.tileSize - 2);
    }

    handleGameOver = () => {
        let gameOverText = 'Game over!\nYour score: ' + this.#trailLength;
        this.#context.font = "30px Verdana";
        this.#context.fillStyle = '#FFFFFF';
        let textMetrics = this.#context.measureText(gameOverText);
        this.#context.fillText(gameOverText, this.#canvas.width / 2 - textMetrics.width / 2, this.#canvas.height / 2);

        this.#trailLength = GameController.minTrailLength;
        this.#currentState = GameController.States.GAME_OVER;

        if (typeof this.#viewListener === 'function') {
            this.#viewListener({ state: this.#currentState });
        }

        this.popExcessTrail();
    }

    popExcessTrail = () => {
        //Remove excess trail to be avoided for next render
        while (this.#trail.length > this.#trailLength) {
            this.#trail.pop();
        }
    }

    //Will find if snake position is intersecting with food in grid
    isFoodPosition = (x, y, inaccurateCheck) => {
        return !inaccurateCheck ? 
                    x == this.#foodX && y == this.#foodY :
                    Math.abs(x - this.#foodX) < GameController.foodIntersectionTolerance && Math.abs(y - this.#foodY) < GameController.foodIntersectionTolerance;     //Allowing inaccurate match for when smooth mode is chosen
    }

    isFoodInterSecting = () => {
        for (let i = 0; i < this.#trail.length; i++) {
            let trailPos = this.#trail[i];
            if (this.isFoodPosition(trailPos.x, trailPos.y, this.#SMOOTH)) {
                return true;
            }
        }

        return false;
    }

    //Cheat :))
    _growTail = (delta) => {
        this.#trailLength += delta;
    }

    //Wrap snake if moving out of bounds
    handleWrap = () => {
        let xBound = this.#boardXMax - 1;
        let yBound = this.#boardYMax - 1;

        if (this.#snakeX > xBound) {
            this.#snakeX = 0;
        } else if (this.#snakeX < 0) {
            this.#snakeX = xBound;
        }

        if (this.#snakeY > yBound) {
            this.#snakeY = 0;
        } else if (this.#snakeY < 0) {
            this.#snakeY = yBound;
        }
    }

    handleResize = (innerWidth, innerHeight) => {
        this.setUpCanvas(innerWidth, innerHeight);
        this.placeFood();
        this.looper();
    }

    updateVector = (newVector) => {
        this.#vector = newVector;
    }

    getVectorDelta = () => {
        return this.#vectorDelta;
    }

    constructor (canvasElem, innerWidth, innerHeight) {
        this.#canvas = canvasElem;
        this.setUpCanvas(innerWidth, innerHeight);
        this.#context = this.#canvas.getContext('2d');

        this.reInit();

        this.loadAssets();
    }

    subscribeToEvents= (listener) => {
        this.#viewListener = listener;
    }

    reInit = () => {
        this.resetSnake();
        this.placeFood();
    }

    pause = () => {
        this.#currentState = GameController.States.PAUSED;
        this.looper();
    }

    resume = () => {
        this.#currentState = GameController.States.RUNNING;
        this.looper();
    }

    isPaused = () => {
        return this.#currentState == GameController.States.PAUSED;
    }

    isRunning = () => {
        return this.#currentState == GameController.States.RUNNING;
    }

    isGameOver = () => {
        return this.#currentState == GameController.States.GAME_OVER;
    }
}


