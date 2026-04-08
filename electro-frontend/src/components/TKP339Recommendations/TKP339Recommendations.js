import React from 'react';
import { generateRecommendations } from '../../utils/tkp339Validations';
import './TKP339Recommendations.css';

const TKP339Recommendations = ({ roomsConfig = {}, roomTypes = [], appliances = [], step1Data = {}, roomsAreas = {}, projectData = {} }) => {
  const { recommendations, warnings } = generateRecommendations(
    roomsConfig,
    roomTypes,
    appliances,
    step1Data,
    projectData
  );

  if (recommendations.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="tkp339-recommendations">
      <div className="recommendations-header">
        <h3>Рекомендации и предупреждения (ТКП 339-2011)</h3>
      </div>

      {warnings.length > 0 && (
        <div className="warnings-section">
          <h4 className="section-title warnings-title">
            <span className="icon">⚠️</span>
            Предупреждения
          </h4>
          <ul className="warnings-list">
            {warnings.map((warning, index) => (
              <li key={index} className="warning-item">
                <div className="warning-content">
                  <strong>{warning.room}:</strong> {warning.message}
                  {warning.appliance && (
                    <span className="appliance-name"> ({warning.appliance})</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h4 className="section-title recommendations-title">
            <span className="icon">ℹ️</span>
            Рекомендации
          </h4>
          <ul className="recommendations-list">
            {recommendations.map((rec, index) => (
              <li key={index} className="recommendation-item">
                {rec.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TKP339Recommendations;

