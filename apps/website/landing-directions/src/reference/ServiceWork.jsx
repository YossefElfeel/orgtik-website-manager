import { PROJECTS } from "./projects";
import "./service-work.css";
import { attr, run } from "../content/copy";
import { msg } from "../content/strings";

export function ServiceWork({ family, service }) {
  const category =
    family.slug === "marketing" ? "digital-marketing" : family.slug;
  const relatedCategory = {
    design: "development",
    development: "hosting",
    "digital-marketing": "design",
    "it-support": "hosting",
    hosting: "it-support",
  }[category];
  const projects = [
    ...PROJECTS.filter((project) => project.service === category),
    ...PROJECTS.filter((project) => project.service === relatedCategory),
  ].slice(0, 2);
  if (!projects.length) return null;
  return (
    <section
      className="service-work"
      id="service-work"
      aria-labelledby="service-work-title"
    >
      <div className="service-work__inner">
        <div className="service-work__heading">
          <div>
            <p className="service-work__eyebrow">
              <span>(04)</span>
              <span className="service-work__eyebrow-rule" aria-hidden="true" />
              <span>
                {run("gl_components|serviceWork-service-work|p", 0)}
                {family.short}
              </span>
            </p>
            <h2 id="service-work-title">
              {run("gl_components|serviceWork-service-work|h2", 0)}
              <br />
              <span>{run("gl_components|serviceWork-service-work|h2", 2)}</span>
            </h2>
          </div>
          <p>
            {run("gl_components|serviceWork-service-work|p-2", 0)}
            {family.short.toLowerCase()}
            {run("gl_components|serviceWork-service-work|p-3", 0)}{" "}
            {service.name.toLowerCase()}
            {run("gl_components|serviceWork-service-work|p-4", 0)}
          </p>
        </div>
        <div className="service-work__grid">
          {projects.map((project) => (
            <a
              className="service-work__card"
              key={project.slug}
              href={"/work#/project/" + project.slug}
            >
              <img
                src={"/assets/" + project.image}
                alt={msg("ServiceWork:1", [project.name])}
                loading="lazy"
              />
              <div className="service-work__body">
                <div className="service-work__tags">
                  <span>{project.status}</span>
                  <span>{project.category}</span>
                </div>
                <h3>{project.name}</h3>
                <p>{project.summary}</p>
                <span className="service-work__link">
                  {run("gl_components|serviceWork-service-work|div", 0)}{" "}
                  <i className="ph ph-arrow-up-right" aria-hidden="true" />
                </span>
              </div>
            </a>
          ))}
        </div>
        <a className="service-work__all" href="/work">
          {run("gl_components|serviceWork-service-work|a", 0)}
          <i className="ph ph-arrow-right" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
