import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FiSearch, FiCheck, FiX, FiChevronDown } from 'react-icons/fi';
import styles from './DepartmentSelector.module.css';

const DepartmentSelector = ({ 
  selectedIds, 
  allDepartments, 
  onChange, 
  placeholder = "Selecionar departamentos..." 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchSetTerm] = useState('');
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.ref?.contains(event.target)) {
        // Unfortunately ref.contains needs the actual DOM element
      }
    };
    // Better implementation using a listener on document
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredDepartments = useMemo(() => {
    return allDepartments.filter(dept => 
      dept.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allDepartments, searchTerm]);

  const toggleSelection = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(item => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedDepts = useMemo(() => {
    return allDepartments.filter(dept => selectedIds.includes(dept.id));
  }, [allDepartments, selectedIds]);

  return (
    <div className={styles.container} ref={containerRef}>
      <div 
        className={`${styles.selector} ${isOpen ? styles.active : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.values}>
          {selectedDepts.length > 0 ? (
            <div className={styles.pills}>
              {selectedDepts.slice(0, 2).map(dept => (
                <span key={dept.id} className={styles.pill}>
                  {dept.name}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(dept.id);
                    }}
                  >
                    <FiX size={12} />
                  </button>
                </span>
              ))}
              {selectedDepts.length > 2 && (
                <span className={styles.moreBadge}>
                  +{selectedDepts.length - 2} mais
                </span>
              )}
            </div>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <FiChevronDown className={`${styles.chevron} ${isOpen ? styles.rotated : ''}`} />
      </div>

      {isOpen && (
        <div className={styles.popover}>
          <div className={styles.searchWrapper}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar departamento..."
              value={searchTerm}
              onChange={(e) => setSearchSetTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className={styles.list}>
            {filteredDepartments.length > 0 ? (
              filteredDepartments.map(dept => {
                const isSelected = selectedIds.includes(dept.id);
                return (
                  <div 
                    key={dept.id} 
                    className={`${styles.listItem} ${isSelected ? styles.selected : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(dept.id);
                    }}
                  >
                    <div className={styles.checkbox}>
                      {isSelected && <FiCheck size={14} />}
                    </div>
                    <span className={styles.deptName}>{dept.name}</span>
                  </div>
                );
              })
            ) : (
              <div className={styles.empty}>Nenhum departamento encontrado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentSelector;
