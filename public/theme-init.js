try{const light=localStorage.getItem('local-converter-theme')==='light';document.documentElement.dataset.theme=light?'light':'dark';document.documentElement.classList.toggle('dark',!light);}catch{}
