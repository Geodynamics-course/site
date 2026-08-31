function registerSQComponents() {
    Alpine.data("qspot", () => ({
        markersList: [],
        targetsList: [],
        answerStatusList: [],
        attempt: 0,
        isShowFeedback: false,
        isAnswerCorrect: false,
        isHintVisible: false,
        init() {
            const container = this.$refs.container;
            const markers = container.querySelectorAll(".marker");
            const markersCount = markers.length;
            markers.forEach((marker, i) => {
                const m = new PlainDraggable(marker, { leftTop: true });
                m.element.style.zIndex = markersCount * 100 - i;
                m.onMoveStart = () => {
                    this.isShowFeedback = false;
                };
                this.markersList.push(m);
            });

            this.targetsList = Array.from(
                container.querySelectorAll(".qspot__area"),
            );

            this.answerStatusList = Array(markers.length).fill(false);
        },
        isCollide(target, marker) {
            const t = target.getBoundingClientRect();
            const m = marker.element.getBoundingClientRect();
            return !(
                t.top > m.bottom ||
                t.right < m.left ||
                t.bottom < m.top ||
                t.left > m.right
            );
        },
        getMarkerClass(index) {
            if (!this.isShowFeedback) return "";
            return this.answerStatusList[index] ? "correct" : "wrong";
        },
        checkAnswer() {
            this.attempt++;
            this.isShowFeedback = true;

            for (let index = 0; index < this.targetsList.length; index++) {
                const target = this.targetsList[index];
                const marker = this.markersList[index];
                const collision = this.isCollide(target, marker);
                this.answerStatusList[index] = collision;
                if (collision) {
                    marker.disabled = true;
                    marker.element.style.opacity = 0;
                    target.classList.add("correct");
                }
            }

            this.isAnswerCorrect = !this.answerStatusList.includes(false);
        },
    }));

    Alpine.data("qselect", (correctAnswer, gate = "") => ({
        answer: "???",
        isCorrect: false,
        attempt: 0,
        correctAnswer: correctAnswer,
        get answerVisibility() {
            return this.isCorrect;
        },
        get questionVisibility() {
            return !this.isCorrect;
        },
        get wrong() {
            return this.answer !== "???" && this.answer !== this.correctAnswer;
        },
        isShakeHead: false,
        init() {
            this.$watch("answer", (value) => {
                this.isCorrect =
                    this.answer === this.correctAnswer ? true : false;
                this.attempt++;
                if (!this.isCorrect) this.shake();
                this.$dispatch("answer-notification", {
                    isCorrect: this.isCorrect,
                    type: "qselect",
                    gate: gate,
                    attempt: this.attempt,
                });
            });
        },
        shake() {
            this.isShakeHead = true;
            setTimeout(() => {
                this.isShakeHead = false;
            }, 600);
        },
    }));

    Alpine.data("qinput", (correctAnswer, tol = 0, gate = "") => ({
        answer: "",
        isCorrect: false,
        correctAnswer: correctAnswer.split("|"),
        attempt: 0,
        tol: tol,
        get answerVisibility() {
            return this.isCorrect;
        },
        get questionVisibility() {
            return !this.isCorrect;
        },
        get wrong() {
            return this.answer !== "" && !this.setIsCorrect(this.answer);
        },
        get hints() {
            return this.wrong && this.attempt >= 3;
        },
        isShakeHead: false,
        init() {
            this.$watch("answer", (value) => {
                this.isCorrect = this.setIsCorrect(this.answer);
                if (!this.isCorrect) this.shake();
                this.$dispatch("answer-notification", {
                    isCorrect: this.isCorrect,
                    type: "qinput",
                    gate: gate,
                    attempt: this.attempt,
                });
            });
        },
        shake() {
            this.isShakeHead = true;
            setTimeout(() => {
                this.isShakeHead = false;
            }, 600);
        },
        setIsCorrect(val) {
            if (this.tol !== null) {
                val = val.replace(",", ".");
                const a = Number(this.correctAnswer[0]);
                if (
                    Number(val) <= a + this.tol &&
                    Number(val) >= a - this.tol
                ) {
                    // ответ попадает в диапазон
                    this.correctAnswer[0] = val; // введённый ответ выведем как правильный
                    return true;
                } else {
                    return false;
                }
            } else {
                // если не задана точность
                return this.correctAnswer.includes(val);
            }
        },
    }));

    Alpine.data("qnext", (gate = "") => ({
        isVisible: true,
        options: {
            ["x-show"]() {
                return this.isVisible;
            },
            ["x-cloak"]() {
                return true;
            },
            ["x-transition"]() {
                return true;
            },
            ["@click"]() {
                this.isVisible = !this.isVisible;
                this.$dispatch("answer-notification", {
                    isCorrect: true,
                    type: "qnext",
                    gate: gate,
                    attempt: 1,
                });
            },
        },
    }));

    Alpine.data("qparson", (loc, source, solution, spacesPerLevel = 4) => ({
        isAnswered: false,
        isShowFeedback: false,
        attempt: 0,
        maxHeight: 0,
        errorMessage: "",
        source: source,
        dest: [],
        solution: solution,
        maxIndent: 3, // максимальное количество отступов
        indentCh: spacesPerLevel, // можно брать из атрибута фильтра

        onSortEnd(item, pos, toArray) {
            if (this.isShowFeedback) this.isShowFeedback = false;

            const fromArray =
                item.container === "source" ? this.source : this.dest;

            const fromIndex = fromArray.findIndex((i) => i.id === item.id);
            fromArray.splice(fromIndex, 1);
            toArray.splice(pos, 0, item);

            item.container = toArray === this.source ? "source" : "dest";

            // сбрасываем отступ, если строка возвращается в 'источник'
            if (toArray === this.source) {
                item.indent = 0;
                item.error = false;
            }

            this.$nextTick(() => {
                Prism.highlightAll();
            });
        },
        incIndent(line) {
            if (this.isAnswered) return; // ответ правильный - отступы не меняем
            line.indent = Math.min(this.maxIndent, line.indent + 1);
            this.isShowFeedback = false;
        },
        decIndent(line) {
            if (this.isAnswered) return; // ответ правильный - отступы не меняем
            line.indent = Math.max(0, line.indent - 1);
            this.isShowFeedback = false;
        },
        codeWrapperStyle(line) {
            const colors = ["#fff0", "#60B99A", "#D3CE3D", "#F77825"];
            return `margin-left: ${this.indMarginString(line)}; border-left: 3px solid ${colors[line.indent]};`;
        },
        indMarginString(line) {
            // значение отступа для margin-left у строки кода
            return `${line.indent * this.indentCh}ch`;
        },
        indentColorGenerator(indent) {
            const colors = ["#fff0", "#60B99A", "#D3CE3D", "#F77825"];
            return colors[indent];
        },
        isErrorLabelVisible(line) {
            return this.isShowFeedback && line.error;
        },
        findLCS(dest, solution) {
            const m = dest.length;
            const n = solution.length;

            // dp[i][j] — длина LCS для dest[0..i-1] и solution[0..j-1]
            const dp = Array.from({ length: m + 1 }, () =>
                Array(n + 1).fill(0),
            );

            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    if (dest[i - 1].code === solution[j - 1].code) {
                        dp[i][j] = dp[i - 1][j - 1] + 1;
                    } else {
                        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                    }
                }
            }

            // Восстановление: собираем id строк из dest, входящих в LCS
            const result = new Set();
            let i = m,
                j = n;
            while (i > 0 && j > 0) {
                if (dest[i - 1].code === solution[j - 1].code) {
                    result.add(dest[i - 1].id);
                    i--;
                    j--;
                } else if (dp[i - 1][j] >= dp[i][j - 1]) {
                    i--;
                } else {
                    j--;
                }
            }

            return result;
        },
        shuffle(array) {
            array.sort(() => Math.random() - 0.5);
        },
        feedback() {
            this.attempt++;
            this.isShowFeedback = true; // показать фидбек по вопросу

            const isSolutionLengthIncorrect =
                this.solution.length !== this.dest.length;
            if (isSolutionLengthIncorrect) {
                this.errorMessage = loc["incorrectNumberOfBlocks"];
                return;
            }

            let isOrderIncorrect = false;
            const lcsCorrectIds = this.findLCS(this.dest, this.solution);

            this.dest.forEach((line, index) => {
                line.error = false;
                if (
                    !lcsCorrectIds.has(line.id) ||
                    line.id > this.solution.length
                ) {
                    isOrderIncorrect = true;
                    line.error = true;
                }
            });

            if (isOrderIncorrect) {
                this.errorMessage = loc["incorrectOrderOfBlocks"];
                return;
            }

            let isIndentationIncorrect = false;
            this.dest.forEach((line, index) => {
                line.error = false;
                if (line.indent !== line.correctIndent) {
                    isIndentationIncorrect = true;
                    line.error = true;
                }
            });

            if (isIndentationIncorrect) {
                this.errorMessage = loc["incorrectIndentationOfBlocks"];
                return;
            }

            this.isShowFeedback = false; // показать фидбек по вопросу
            this.errorMessage = "";
            this.isAnswered = true;
        },
    }));
}

if (window.Alpine) {
    registerSQComponents();
} else {
    document.addEventListener("alpine:init", () => {
        registerSQComponents();
    });
}
