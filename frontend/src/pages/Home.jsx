import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const SECTIONS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "services", label: "Services" },
  { id: "exams", label: "Exams" },
  { id: "initiatives", label: "Initiatives" },
  { id: "team", label: "Team" },
  { id: "contact", label: "Contact" },
]

function Home() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("home")
  const [scrolled, setScrolled] = useState(false)
  const [toast, setToast] = useState("")
  const [form, setForm] = useState({ fname: "", lname: "", email: "", subject: "", message: "" })

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
      const sections = document.querySelectorAll("section[id]")
      sections.forEach(s => {
        if (window.scrollY >= s.offsetTop - 100) setActiveSection(s.id)
      })
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  const submitContact = () => {
    if (!form.fname || !form.email || !form.subject || !form.message) {
      showToast("Please fill in all required fields.")
      return
    }
    showToast("Message sent! We'll get back to you within 24 hours.")
    setForm({ fname: "", lname: "", email: "", subject: "", message: "" })
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#1a1a2e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        html { scroll-behavior:smooth; }
        :root {
          --navy:#0a1628; --navy2:#112240; --navy3:#1a3a5c;
          --gold:#c9a84c; --gold2:#e2c06a; --gold3:#f5e09a;
          --white:#ffffff; --gray:#f4f6f9; --muted:#64748b;
          --border:rgba(201,168,76,0.2);
        }
        .nav-link { color:rgba(255,255,255,0.75); font-size:.88rem; font-weight:500; cursor:pointer; transition:color .2s; text-decoration:none; letter-spacing:.01em; }
        .nav-link:hover, .nav-link.active { color:#c9a84c; }
        .btn-outline { padding:.45rem 1.1rem; border:1.5px solid #c9a84c; color:#c9a84c; border-radius:6px; font-size:.85rem; font-weight:600; transition:all .2s; cursor:pointer; background:transparent; font-family:inherit; }
        .btn-outline:hover { background:#c9a84c; color:#0a1628; }
        .btn-gold { padding:.45rem 1.1rem; background:#c9a84c; color:#0a1628; border-radius:6px; font-size:.85rem; font-weight:700; transition:all .2s; cursor:pointer; border:none; font-family:inherit; }
        .btn-gold:hover { background:#e2c06a; transform:translateY(-1px); }
        .btn-hero-primary { padding:.85rem 2rem; background:#c9a84c; color:#0a1628; border-radius:8px; font-size:1rem; font-weight:700; border:none; cursor:pointer; transition:all .2s; font-family:inherit; }
        .btn-hero-primary:hover { background:#e2c06a; transform:translateY(-2px); box-shadow:0 8px 24px rgba(201,168,76,0.3); }
        .btn-hero-secondary { padding:.85rem 2rem; background:transparent; color:#fff; border-radius:8px; font-size:1rem; font-weight:600; border:1.5px solid rgba(255,255,255,0.3); cursor:pointer; transition:all .2s; font-family:inherit; }
        .btn-hero-secondary:hover { border-color:#c9a84c; color:#c9a84c; }
        .service-card { background:#fff; border:1px solid #e8edf5; border-radius:14px; padding:2rem; transition:all .3s; position:relative; overflow:hidden; }
        .service-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#c9a84c,#e2c06a); opacity:0; transition:opacity .3s; }
        .service-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(10,22,40,0.1); border-color:#c9a84c; }
        .service-card:hover::before { opacity:1; }
        .exam-card { background:#fff; border-radius:14px; overflow:hidden; border:1px solid #e8edf5; transition:all .3s; }
        .exam-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(10,22,40,0.1); }
        .mission-card { background:rgba(255,255,255,0.05); border:1px solid rgba(201,168,76,0.15); border-radius:14px; padding:2rem; text-align:center; transition:all .3s; }
        .mission-card:hover { background:rgba(201,168,76,0.08); border-color:#c9a84c; transform:translateY(-3px); }
        .initiative-card { border-radius:14px; overflow:hidden; border:1px solid #e8edf5; transition:all .3s; }
        .initiative-card:hover { box-shadow:0 12px 32px rgba(10,22,40,0.1); transform:translateY(-3px); }
        .team-card { background:#fff; border-radius:14px; padding:2rem; text-align:center; border:1px solid #e8edf5; transition:all .3s; }
        .team-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(10,22,40,0.1); border-color:#c9a84c; }
        .form-input { width:100%; padding:.7rem 1rem; border:1.5px solid #e2e8f0; border-radius:8px; font-size:.9rem; font-family:inherit; background:#fff; color:#1a1a2e; transition:border-color .2s; outline:none; }
        .form-input:focus { border-color:#c9a84c; }
        .btn-submit { width:100%; padding:.85rem; background:#0a1628; color:#fff; border:none; border-radius:8px; font-size:.9rem; font-weight:700; cursor:pointer; transition:all .2s; font-family:inherit; }
        .btn-submit:hover { background:#c9a84c; color:#0a1628; }
        .btn-exam { width:100%; padding:.75rem; background:#0a1628; color:#fff; border:none; border-radius:8px; font-size:.88rem; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; }
        .btn-exam:hover { background:#c9a84c; color:#0a1628; }
        .toast { position:fixed; bottom:2rem; right:2rem; background:#0a1628; color:#fff; padding:1rem 1.5rem; border-radius:10px; border-left:4px solid #c9a84c; font-size:.9rem; font-weight:500; z-index:9999; transition:all .4s; }
        .hamburger { display:none; flex-direction:column; gap:5px; cursor:pointer; background:none; border:none; padding:.5rem; }
        .hamburger span { width:24px; height:2px; background:#fff; border-radius:2px; display:block; }
        @media(max-width:768px) {
          .nav-desktop { display:none !important; }
          .hamburger { display:flex !important; }
          .mobile-menu-panel { display:flex; }
        }
        @media(min-width:769px) {
          .mobile-menu-panel { display:none !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:999,
        background: scrolled ? "rgba(10,22,40,0.99)" : "rgba(10,22,40,0.97)",
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.3)" : "none",
        borderBottom:"1px solid rgba(201,168,76,0.2)",
        padding:"0 5%", height:70,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        transition:"all .3s"
      }}>
        <div style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer"}} onClick={()=>scrollTo("home")}>
          <div style={{width:38,height:38,background:"#c9a84c",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:"1.1rem",color:"#0a1628"}}>T</div>
          <span style={{fontSize:"1.2rem",fontWeight:800,color:"#fff",letterSpacing:"-.02em"}}>ExcellenceYouth<span style={{color:"#c9a84c"}}>TalentSearch LLP</span></span>
        </div>

        <div className="nav-desktop" style={{display:"flex", gap:"2rem", alignItems:"center"}}>
          {SECTIONS.map(s=>(
            <span key={s.id} className={`nav-link${activeSection===s.id?" active":""}`} onClick={()=>scrollTo(s.id)}>{s.label}</span>
          ))}
        </div>

        <div className="nav-desktop" style={{display:"flex", gap:".75rem", alignItems:"center"}}>
          <button className="btn-outline" onClick={()=>navigate("/login")}>Login</button>
          <button className="btn-gold" onClick={()=>navigate("/signup")}>Sign Up</button>
        </div>

        <button className="hamburger" onClick={()=>setMenuOpen(o=>!o)}>
          <span/><span/><span/>
        </button>
      </nav>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <div className="mobile-menu-panel" style={{
          position:"fixed", top:70, left:0, right:0, bottom:0,
          background:"#0a1628", zIndex:998, flexDirection:"column",
          padding:"2rem 5%", gap:"1.5rem", overflowY:"auto", display:"flex"
        }}>
          {SECTIONS.map(s=>(
            <span key={s.id} style={{color:"#fff",fontSize:"1.1rem",fontWeight:600,borderBottom:"1px solid rgba(255,255,255,0.08)",paddingBottom:"1rem",cursor:"pointer"}} onClick={()=>scrollTo(s.id)}>{s.label}</span>
          ))}
          <div style={{display:"flex",flexDirection:"column",gap:".75rem",marginTop:"1rem"}}>
            <button className="btn-outline" onClick={()=>navigate("/login")}>Login</button>
            <button className="btn-gold" onClick={()=>navigate("/signup")}>Sign Up</button>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section id="home" style={{minHeight:"100vh",background:"linear-gradient(135deg,#0a1628 0%,#112240 50%,#1a3a5c 100%)",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"100px 5% 60px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"rgba(201,168,76,0.06)",top:-150,right:-150,pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:"rgba(201,168,76,0.06)",bottom:-100,left:-80,pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1,maxWidth:800}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:".5rem",background:"rgba(201,168,76,0.12)",border:"1px solid rgba(201,168,76,0.2)",color:"#c9a84c",padding:".4rem 1rem",borderRadius:999,fontSize:".8rem",fontWeight:600,marginBottom:"1.75rem",letterSpacing:".04em"}}>
            India's Premier Competitive Examination Platform
          </div>
          <h1 style={{fontSize:"clamp(2.5rem,5vw,4rem)",fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:"1.25rem",letterSpacing:"-.03em"}}>
            Empowering Talent.<br/>Defining <span style={{color:"#c9a84c"}}>Excellence.</span>
          </h1>
          <p style={{fontSize:"1.1rem",color:"rgba(255,255,255,0.65)",maxWidth:580,margin:"0 auto 2.5rem",lineHeight:1.7}}>
            EYTS conducts high-class competitive examinations, connecting aspirants with opportunities and give a chanse to win scholarships and prizes. We are committed to providing a fair, transparent, and credible platform for students to showcase their skills and knowledge.
          </p>
          <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-hero-primary" onClick={()=>navigate("/signup")}>Register Now →</button>
            <button className="btn-hero-secondary" onClick={()=>scrollTo("exams")}>View Upcoming Exams</button>
          </div>
          <div style={{display:"flex",gap:"3rem",justifyContent:"center",flexWrap:"wrap",marginTop:"4rem",paddingTop:"3rem",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            {[["-","Registered Students"],["-","Exams Conducted"],["-%","Accuracy Rate"],["-","Partner Institutions"]].map(([n,l])=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:"2rem",fontWeight:800,color:"#c9a84c"}}>{n}</div>
                <div style={{fontSize:".8rem",color:"rgba(255,255,255,0.5)",marginTop:".25rem",textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" style={{padding:"90px 5%",background:"#f4f6f9"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4rem",alignItems:"center"}}>
          <div style={{background:"linear-gradient(135deg,#0a1628,#1a3a5c)",borderRadius:16,padding:"3rem",color:"#fff",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:"rgba(201,168,76,0.1)"}}/>
            <div style={{fontSize:"4rem",color:"#c9a84c",lineHeight:.5,display:"block",marginBottom:".5rem"}}>"</div>
            <div style={{fontSize:"1.2rem",fontWeight:600,lineHeight:1.6,color:"#e2c06a",marginBottom:"1.5rem",position:"relative",zIndex:1}}>Talent is universal; opportunity should be too. We build the bridge.</div>
            <div style={{fontSize:".85rem",color:"rgba(255,255,255,0.6)",position:"relative",zIndex:1}}>— Prashannjit , Director of EYTS LLP, 2026</div>
          </div>
          <div>
            <div style={{display:"inline-flex",background:"rgba(201,168,76,0.1)",color:"#c9a84c",padding:".35rem .9rem",borderRadius:999,fontSize:".75rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:"1rem"}}>📖 About Us</div>
            <h2 style={{fontSize:"clamp(1.8rem,3.5vw,2.6rem)",fontWeight:800,color:"#0a1628",lineHeight:1.15,marginBottom:"1rem",letterSpacing:"-.02em"}}>Who We <span style={{color:"#c9a84c"}}>Are</span></h2>
            {["Excellence Youth Talent Search LLP is a knowledge-driven examination and assessment organisation founded with the mission of democratising access to quality evaluation systems. We believe every talented individual deserves a fair, transparent, and credible platform to demonstrate their capabilities.","Headquartered in Kawardha, Chhattisgarh, India with a vision to expand globally, EYTS conducts competitive examinations for educational institutions, government bodies, and corporate organisations.","Beyond examinations, EYTS is building an ecosystem that includes healthcare initiatives and social welfare programmes — because we recognise that talent flourishes only when individuals have access to health, education, and opportunity."].map((t,i)=>(
              <p key={i} style={{color:"#64748b",lineHeight:1.8,marginBottom:"1rem",fontSize:".95rem"}}>{t}</p>
            ))}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginTop:"1.5rem"}}>
              {[["Our Mission","Provide fair, transparent, and scalable examination solutions to every aspirant across India."],["Our Vision","Become India's most trusted examination authority, expanding into global markets by 2030."],["Integrity","Every examination is conducted with the highest standards of fairness and security."],["Inclusivity","Accessible to students from all backgrounds, geographies, and economic conditions."]].map(([t,d])=>(
                <div key={t} style={{background:"#fff",borderRadius:10,padding:"1rem",borderLeft:"3px solid #c9a84c"}}>
                  <div style={{fontWeight:700,fontSize:".88rem",color:"#0a1628",marginBottom:".25rem"}}>{t}</div>
                  <div style={{fontSize:".8rem",color:"#64748b",lineHeight:1.5}}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" style={{padding:"90px 5%",background:"#fff"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center"}}>
            <div style={{display:"inline-flex",background:"rgba(201,168,76,0.1)",color:"#c9a84c",padding:".35rem .9rem",borderRadius:999,fontSize:".75rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:"1rem"}}>What We Do</div>
            <h2 style={{fontSize:"clamp(1.8rem,3.5vw,2.6rem)",fontWeight:800,color:"#0a1628",marginBottom:"1rem",letterSpacing:"-.02em"}}>Our <span style={{color:"#c9a84c"}}>Services</span></h2>
            <p style={{fontSize:"1rem",color:"#64748b",maxWidth:560,margin:"0 auto 3rem",lineHeight:1.7}}>From competitive examinations to institutional assessments, TalentExam delivers end-to-end solutions tailored to your needs.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"1.5rem"}}>
            {[
              ["","Online Competitive Exams","Conduct large-scale MCQ-based examinations with real-time evaluation, automated ranking, and result publication for thousands of candidates at the end of the  day.","Core Service"],
              ["","Government Exam Partnerships","Working toward partnerships with state and central government bodies to conduct recruitment and entrance examinations with highest security standards.","Coming Soon"],
              ["","Institutional Assessment","Custom examination solutions for colleges, universities, and training institutes with configurable question banks, sections, and analytics.","Available"],
              ["","Corporate Recruitment Testing","Screen and evaluate job candidates through standardised aptitude, reasoning, and domain-specific assessments with detailed performance reports.","Available"],
              ["","Performance Analytics","Advanced dashboards providing section-wise breakdown, percentile ranking, leaderboard comparisons, and historical trend analysis.","Core Service"],
              ["","Secure Proctoring","AI-powered proctoring with tab-switch detection, webcam monitoring, and behavioural analysis ensures examination integrity.","In Development"],
            ].map(([icon,title,text,tag])=>(
              <div key={title} className="service-card">
                <div style={{width:52,height:52,borderRadius:12,background:"rgba(201,168,76,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",marginBottom:"1.25rem"}}>{icon}</div>
                <div style={{fontSize:"1.05rem",fontWeight:700,color:"#0a1628",marginBottom:".5rem"}}>{title}</div>
                <div style={{fontSize:".88rem",color:"#64748b",lineHeight:1.7,marginBottom:"1rem"}}>{text}</div>
                <span style={{display:"inline-block",background:"rgba(201,168,76,0.1)",color:"#c9a84c",padding:".2rem .6rem",borderRadius:4,fontSize:".72rem",fontWeight:600}}>{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAMS ── */}
      <section id="exams" style={{padding:"90px 5%",background:"#f4f6f9"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center"}}>
            <div style={{display:"inline-flex",background:"rgba(201,168,76,0.1)",color:"#c9a84c",padding:".35rem .9rem",borderRadius:999,fontSize:".75rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:"1rem"}}>Upcoming Exams</div>
            <h2 style={{fontSize:"clamp(1.8rem,3.5vw,2.6rem)",fontWeight:800,color:"#0a1628",marginBottom:"1rem",letterSpacing:"-.02em"}}>Examination <span style={{color:"#c9a84c"}}>Schedule</span></h2>
            <p style={{fontSize:"1rem",color:"#64748b",maxWidth:560,margin:"0 auto 3rem",lineHeight:1.7}}>Register for upcoming examinations. Secure your seat early — registrations close 7 days before the examination date.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:"1.5rem"}}>
            {[
              {badge:"Open Now",title:"TalentExam National 2026",sub:"All India Competitive Examination",details:[["Exam Date","03 October 2026"],["Registration Ends","28 September 2026"],["Duration","50 Minutes"],["Questions","60 MCQ"],["Fee","₹299/-"]],status:"● Registrations Open",statusColor:"#16a34a",btn:"Register Now →",btnFn:()=>navigate("/signup")},
              {badge:"Upcoming",title:"TalentExam State Series",sub:"State-Level Competitive Exam",details:[["Exam Date","To be announced"],["Registration Ends","To be announced"],["Duration","-"],["Questions","-"],["Fee","-"]],status:"● Opening Soon",statusColor:"#c9a84c",btn:"Set Reminder",btnFn:()=>showToast("Registrations open on 1 September 2025")},
              {badge:"Upcoming",title:"TalentExam Tech Challenge",sub:"Engineering & Technical Assessment",details:[["Exam Date","To be announced"],["Registration Ends","To be announced"],["Duration","-"],["Questions","-"],["Fee","-"]],status:"● Opening Soon",statusColor:"#c9a84c",btn:"Set Reminder",btnFn:()=>showToast("Registrations open on 1 November 2025")},
            ].map(e=>(
              <div key={e.title} className="exam-card">
                <div style={{background:"linear-gradient(135deg,#0a1628,#1a3a5c)",padding:"1.5rem",color:"#fff"}}>
                  <div style={{display:"inline-block",background:"rgba(201,168,76,0.2)",color:"#c9a84c",padding:".2rem .6rem",borderRadius:4,fontSize:".72rem",fontWeight:700,marginBottom:".75rem",textTransform:"uppercase",letterSpacing:".04em"}}>{e.badge}</div>
                  <div style={{fontSize:"1.1rem",fontWeight:700,marginBottom:".25rem"}}>{e.title}</div>
                  <div style={{fontSize:".8rem",color:"rgba(255,255,255,0.6)"}}>{e.sub}</div>
                </div>
                <div style={{padding:"1.5rem"}}>
                  {e.details.map(([l,v])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:".5rem 0",borderBottom:"1px solid #f0f0f0",fontSize:".85rem"}}>
                      <span style={{color:"#64748b"}}>{l}</span>
                      <span style={{fontWeight:600,color:"#0a1628"}}>{v}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:".5rem 0",fontSize:".85rem"}}>
                    <span style={{color:"#64748b"}}>Status</span>
                    <span style={{fontWeight:700,color:e.statusColor}}>{e.status}</span>
                  </div>
                </div>
                <div style={{padding:"0 1.5rem 1.5rem"}}>
                  <button className="btn-exam" onClick={e.btnFn}>{e.btn}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section id="mission" style={{padding:"90px 5%",background:"linear-gradient(135deg,#0a1628,#112240)",color:"#fff",textAlign:"center"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"inline-flex",background:"rgba(201,168,76,0.15)",color:"#c9a84c",padding:".35rem .9rem",borderRadius:999,fontSize:".75rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:"1rem"}}>Our Purpose</div>
          <h2 style={{fontSize:"clamp(1.8rem,3.5vw,2.6rem)",fontWeight:800,color:"#fff",marginBottom:"1rem",letterSpacing:"-.02em"}}>Driven by a <span style={{color:"#c9a84c"}}>Greater Mission</span></h2>
          <p style={{fontSize:"1rem",color:"rgba(255,255,255,0.6)",maxWidth:560,margin:"0 auto 3rem",lineHeight:1.7}}>EYTS LLP was built on the belief that knowledge should be the only criterion for opportunity.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"2rem"}}>
            {[["","Education First","Partner with educational institutions to standardise assessments and provide credible certifications recognised across India."],["","Fair Evaluation","Eliminate bias and subjectivity through technology-driven, standardised examination systems accessible to every aspirant."],["","National Reach","Reach students in every district of India through our online platform, removing geographic and logistic barriers."],["","Community Impact","Give back through NGO programmes, scholarships, and healthcare initiatives that uplift communities beyond examinations."]].map(([icon,title,text])=>(
              <div key={title} className="mission-card">
                <div style={{fontSize:"2.5rem",marginBottom:"1rem"}}>{icon}</div>
                <div style={{fontSize:"1rem",fontWeight:700,color:"#c9a84c",marginBottom:".5rem"}}>{title}</div>
                <div style={{fontSize:".85rem",color:"rgba(255,255,255,0.6)",lineHeight:1.6}}>{text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INITIATIVES ── */}
      <section id="initiatives" style={{padding:"90px 5%",background:"#fff"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center"}}>
            <div style={{display:"inline-flex",background:"rgba(201,168,76,0.1)",color:"#c9a84c",padding:".35rem .9rem",borderRadius:999,fontSize:".75rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:"1rem"}}>Future Initiatives</div>
            <h2 style={{fontSize:"clamp(1.8rem,3.5vw,2.6rem)",fontWeight:800,color:"#0a1628",marginBottom:"1rem",letterSpacing:"-.02em"}}>Beyond <span style={{color:"#c9a84c"}}>Examinations</span></h2>
            <p style={{fontSize:"1rem",color:"#64748b",maxWidth:560,margin:"0 auto 3rem",lineHeight:1.7}}>EYTS LLP is building a complete ecosystem — combining education, healthcare, and social welfare under one organisation.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"1.5rem"}}>
            {[
              {bg:"linear-gradient(135deg,#0a1628,#1a3a5c)",icon:"",title:"Examination Division",sub:"Core Business · Active",text:"Our primary division conducts online competitive examinations for students, institutions, and government bodies across India.",items:["Online MCQ-based examinations","Automated evaluation & ranking","AI proctoring (in development)","Government exam partnerships (planned)","National certification programmes"]},
              {bg:"linear-gradient(135deg,#0f4c35,#1a7a55)",icon:"",title:"EYTS Hospitals",sub:"Healthcare Division · Planned 2027-2028",text:"We plan to establish affordable healthcare facilities in underserved regions, ensuring talent can flourish when health is not a barrier.",items:["Affordable primary healthcare centres","Free health camps for students","Mental health & wellness programmes","Medical scholarship for toppers","Rural health outreach"]},
              {bg:"linear-gradient(135deg,#4a1a6b,#7b2fa8)",icon:"",title:"EYTS NGO",sub:"Social Welfare · Planned 2027-2028",text:"Our NGO arm will focus on education access, women empowerment, and rural development — creating a complete cycle of opportunity.",items:["Free coaching for underprivileged students","Scholarship & financial aid programmes","Women leadership initiatives","Digital literacy in rural areas","Community development projects"]},
            ].map(d=>(
              <div key={d.title} className="initiative-card">
                <div style={{padding:"2rem",background:d.bg}}>
                  <div style={{fontSize:"2rem",marginBottom:".75rem"}}>{d.icon}</div>
                  <div style={{fontSize:"1.1rem",fontWeight:700,color:"#fff",marginBottom:".25rem"}}>{d.title}</div>
                  <div style={{fontSize:".8rem",color:"rgba(255,255,255,0.6)"}}>{d.sub}</div>
                </div>
                <div style={{padding:"1.5rem",background:"#fff"}}>
                  <p style={{fontSize:".88rem",color:"#64748b",lineHeight:1.7,marginBottom:"1rem"}}>{d.text}</p>
                  <ul style={{listStyle:"none"}}>
                    {d.items.map(item=>(
                      <li key={item} style={{fontSize:".83rem",color:"#64748b",padding:".25rem 0",display:"flex",alignItems:"center",gap:".5rem"}}>
                        <span style={{color:"#c9a84c",fontWeight:700}}>✓</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div style={{background:"#0a1628",padding:"60px 5%"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"2rem",textAlign:"center"}}>
          {[["-","Students Registered"],["-","Exams Conducted"],["-%","Accuracy Rate"],["-","Partner Institutions"],["-","States Covered"]].map(([n,l])=>(
            <div key={l}>
              <div style={{fontSize:"2.5rem",fontWeight:900,color:"#c9a84c"}}>{n}</div>
              <div style={{fontSize:".82rem",color:"rgba(255,255,255,0.55)",marginTop:".3rem",textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TEAM ── */}
      <section id="team" style={{padding:"90px 5%",background:"#f4f6f9"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center"}}>
            <div style={{display:"inline-flex",background:"rgba(201,168,76,0.1)",color:"#c9a84c",padding:".35rem .9rem",borderRadius:999,fontSize:".75rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:"1rem"}}>Leadership</div>
            <h2 style={{fontSize:"clamp(1.8rem,3.5vw,2.6rem)",fontWeight:800,color:"#0a1628",marginBottom:"1rem",letterSpacing:"-.02em"}}>Meet Our <span style={{color:"#c9a84c"}}>Team</span></h2>
            <p style={{fontSize:"1rem",color:"#64748b",maxWidth:560,margin:"0 auto 3rem",lineHeight:1.7}}>The passionate individuals behind EYTS, committed to transforming the examination landscape in India.</p>
          </div>
          {/* ["AM","[Academic Head]","Head of Academics","Curates examination content, maintains question bank quality, and ensures academic integrity."]  */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"1.5rem"}}>
            {[
              ["Nisha.jpeg","Mrs Nisha","Founder & CEO","Visionary leader driving EYTS's mission to democratise competitive examinations across India.",null],
              ["Prashannjit.jpeg","Prashannjit","Director","Oversees examination operations, institutional partnerships, and quality assurance.",null]
            ].map(([img, name, role, bio, link])=>(
              <div key={name} className="team-card">
                <div style={{width:72,height:72,borderRadius:"50%",margin:"0 auto 1rem",overflow:"hidden",border:"3px solid #c9a84c",flexShrink:0}}>
                  <img
                    src={`/images/${img}`}
                    alt={name}
                    style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center"}}
                    onError={e => {
                      e.target.parentNode.style.background = "linear-gradient(135deg,#0a1628,#1a3a5c)"
                      e.target.parentNode.style.display = "flex"
                      e.target.parentNode.style.alignItems = "center"
                      e.target.parentNode.style.justifyContent = "center"
                      e.target.outerHTML = `<span style="color:#c9a84c;font-size:1.5rem;font-weight:800;">${name[0]}</span>`
                    }}
                  />
                </div>
                <div style={{fontSize:"1rem",fontWeight:700,color:"#0a1628",marginBottom:".25rem"}}>{name}</div>
                <div style={{fontSize:".8rem",color:"#c9a84c",fontWeight:600,marginBottom:".5rem"}}>{role}</div>
                <div style={{fontSize:".8rem",color:"#64748b",lineHeight:1.6,marginBottom:".5rem"}}>{bio}</div>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{fontSize:".78rem",color:"#0a1628",fontWeight:600,textDecoration:"none",borderBottom:"1px solid #c9a84c",paddingBottom:"1px"}}
                    onMouseEnter={e=>e.target.style.color="#c9a84c"}
                    onMouseLeave={e=>e.target.style.color="#0a1628"}
                   >
                    Portfolio
                   </a>  
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{padding:"90px 5%",background:"#fff"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{textAlign:"center"}}>
            <div style={{display:"inline-flex",background:"rgba(201,168,76,0.1)",color:"#c9a84c",padding:".35rem .9rem",borderRadius:999,fontSize:".75rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:"1rem"}}>Get In Touch</div>
            <h2 style={{fontSize:"clamp(1.8rem,3.5vw,2.6rem)",fontWeight:800,color:"#0a1628",marginBottom:"1rem",letterSpacing:"-.02em"}}>Contact <span style={{color:"#c9a84c"}}>Us</span></h2>
            <p style={{fontSize:"1rem",color:"#64748b",maxWidth:560,margin:"0 auto 3rem",lineHeight:1.7}}>Have questions about our examinations, partnerships, or initiatives? We'd love to hear from you.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4rem"}}>
            <div>
              <h3 style={{fontSize:"1.2rem",fontWeight:700,color:"#0a1628",marginBottom:"1.5rem"}}>Reach Out To Us</h3>
              {[["","Head Office","EYTS LLP.\nKawardha, Chhattisgarh — 491995\nIndia"],["","Email","priyanksha1803@gmail.com"],["","Phone","+91 7999832476\nMon–Sat, 9 AM – 6 PM IST"],["","Support Hours","Monday to Saturday\n9:00 AM – 6:00 PM IST"]].map(([icon,title,text])=>(
                <div key={title} style={{display:"flex",gap:"1rem",marginBottom:"1.5rem",alignItems:"flex-start"}}>
                  <div style={{width:44,height:44,background:"rgba(201,168,76,0.1)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{icon}</div>
                  <div>
                    <div style={{fontSize:".88rem",fontWeight:700,color:"#0a1628",marginBottom:".2rem"}}>{title}</div>
                    <div style={{fontSize:".85rem",color:"#64748b",lineHeight:1.5,whiteSpace:"pre-line"}}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:"#f4f6f9",borderRadius:16,padding:"2rem"}}>
              <h3 style={{fontSize:"1.1rem",fontWeight:700,color:"#0a1628",marginBottom:"1.5rem"}}>Send Us a Message</h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
                <div><label style={{fontSize:".8rem",fontWeight:600,color:"#0a1628",marginBottom:".4rem",display:"block",textTransform:"uppercase",letterSpacing:".04em"}}>First Name</label><input className="form-input" placeholder="Amit" value={form.fname} onChange={e=>setForm(f=>({...f,fname:e.target.value}))}/></div>
                <div><label style={{fontSize:".8rem",fontWeight:600,color:"#0a1628",marginBottom:".4rem",display:"block",textTransform:"uppercase",letterSpacing:".04em"}}>Last Name</label><input className="form-input" placeholder="singh" value={form.lname} onChange={e=>setForm(f=>({...f,lname:e.target.value}))}/></div>
              </div>
              <div style={{marginBottom:"1rem"}}><label style={{fontSize:".8rem",fontWeight:600,color:"#0a1628",marginBottom:".4rem",display:"block",textTransform:"uppercase",letterSpacing:".04em"}}>Email</label><input className="form-input" type="email" placeholder="you@email.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div style={{marginBottom:"1rem"}}><label style={{fontSize:".8rem",fontWeight:600,color:"#0a1628",marginBottom:".4rem",display:"block",textTransform:"uppercase",letterSpacing:".04em"}}>Subject</label>
                <select className="form-input" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}>
                  <option value="">Select a subject</option>
                  <option>Examination Registration</option>
                  <option>Institutional Partnership</option>
                  <option>Corporate Assessment</option>
                  <option>NGO / Healthcare Initiative</option>
                  <option>Technical Support</option>
                  <option>General Enquiry</option>
                </select>
              </div>
              <div style={{marginBottom:"1rem"}}><label style={{fontSize:".8rem",fontWeight:600,color:"#0a1628",marginBottom:".4rem",display:"block",textTransform:"uppercase",letterSpacing:".04em"}}>Message</label><textarea className="form-input" rows={4} placeholder="Tell us how we can help you..." value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} style={{resize:"vertical"}}/></div>
              <button className="btn-submit" onClick={submitContact}>Send Message →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{padding:"80px 5%",background:"linear-gradient(135deg,#0a1628,#1a3a5c)",textAlign:"center"}}>
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <h2 style={{fontSize:"clamp(1.8rem,3vw,2.5rem)",fontWeight:800,color:"#fff",marginBottom:"1rem"}}>Ready to Showcase Your Talent?</h2>
          <p style={{fontSize:"1rem",color:"rgba(255,255,255,0.6)",marginBottom:"2rem"}}>Join us, Your next opportunity starts here.</p>
          <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-hero-primary" onClick={()=>navigate("/signup")}>Create Free Account →</button>
            <button className="btn-hero-secondary" onClick={()=>scrollTo("exams")}>View All Exams</button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{background:"#0a1628",color:"rgba(255,255,255,0.5)",padding:"60px 5% 30px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:"3rem",marginBottom:"3rem"}}>
            <div>
              <div style={{fontSize:"1.3rem",fontWeight:800,color:"#fff",marginBottom:".75rem"}}>EYTS</div>
              <p style={{fontSize:".85rem",lineHeight:1.7,maxWidth:260}}>India's premier online competitive examination platform. Empowering talent, defining excellence, building futures.</p>
            </div>
            {[["Quick Links",[["Home","#home"],["About Us","#about"],["Services","#services"],["Examinations","#exams"],["Contact","#contact"]]],["Student Portal",[["Login","/login"],["Register","/signup"],["My Dashboard","/dashboard"],["My Results","/dashboard"]]]].map(([heading,links])=>(
              <div key={heading}>
                <h4 style={{fontSize:".88rem",fontWeight:700,color:"#fff",marginBottom:"1rem",textTransform:"uppercase",letterSpacing:".06em"}}>{heading}</h4>
                {links.map(([label,href])=>(
                  <div key={label} style={{marginBottom:".5rem"}}>
                    <span style={{fontSize:".83rem",color:"rgba(255,255,255,0.5)",cursor:"pointer",transition:"color .2s"}}
                      onClick={()=>href.startsWith("/") ? navigate(href) : scrollTo(href.replace("#",""))}
                      onMouseEnter={e=>e.target.style.color="#c9a84c"}
                      onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.5)"}
                    >{label}</span>
                  </div>
                ))}
              </div>
            ))}
            <div>
              <h4 style={{fontSize:".88rem",fontWeight:700,color:"#fff",marginBottom:"1rem",textTransform:"uppercase",letterSpacing:".06em"}}>Examinations</h4>
              {["TalentExam National","State Series","Tech Challenge","View Schedule"].map(l=>(
                <div key={l} style={{marginBottom:".5rem"}}><span style={{fontSize:".83rem",color:"rgba(255,255,255,0.5)",cursor:"pointer"}} onClick={()=>scrollTo("exams")} onMouseEnter={e=>e.target.style.color="#c9a84c"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.5)"}>{l}</span></div>
              ))}
            </div>
          </div>
          <div style={{height:1,background:"rgba(255,255,255,0.08)",marginBottom:"1.5rem"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"1rem"}}>
            <div style={{fontSize:".8rem"}}>© 2025 TalentExam Pvt. Ltd. All rights reserved.</div>
            <div style={{display:"flex",gap:"1.5rem"}}>
              {["Privacy Policy","Terms of Use","Refund Policy"].map(l=>(
                <span key={l} style={{fontSize:".8rem",color:"rgba(255,255,255,0.4)",cursor:"pointer"}} onMouseEnter={e=>e.target.style.color="#c9a84c"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.4)"}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── TOAST ── */}
      {toast && (
        <div className="toast">{toast}</div>
      )}
    </div>
  )
}

export default Home