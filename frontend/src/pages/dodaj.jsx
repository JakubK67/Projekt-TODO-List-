function DodajZadanie() {
  return (
    <>
        <div className="dozrobienia">
            <h1 className="statusy-h1">Do zrobienia</h1>
            <div className="zadania">
                <div className="zadanie">
                    <h2>Treść zadania</h2>
                    <h4>01.01.2026</h4>
                </div>
                <div className="dodawanie">
                    <h1>+</h1>
                </div>
            </div>
        </div>

        <div className="realizowane">
            <h1 className="statusy-h1">Realizowane</h1>
            <div className="zadania">
                <div className="dodawanie">
                    <h1>+</h1>
                </div>
            </div>
        </div>
        <div className="wykonane">
            <h1 className="statusy-h1">Wykonane</h1>
            <div className="zadania">
                <div className="dodawanie">
                    <h1>+</h1>
                </div>
            </div>
        </div>
    </>
  )
}

export default DodajZadanie;