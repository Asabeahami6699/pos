import React, { useEffect } from 'react';

import { Button } from './Button';



type ModalSize = 'sm' | 'md' | 'lg' | 'xl';



const sizeClasses: Record<ModalSize, string> = {

  sm: 'sm:max-w-md',

  md: 'sm:max-w-lg',

  lg: 'sm:max-w-2xl',

  xl: 'sm:max-w-3xl',

};



interface ModalProps {

  isOpen: boolean;

  onClose: () => void;

  title: string;

  children: React.ReactNode;

  footer?: React.ReactNode;

  size?: ModalSize;

  scrollable?: boolean;

}



export const Modal: React.FC<ModalProps> = ({

  isOpen,

  onClose,

  title,

  children,

  footer,

  size = 'md',

  scrollable = false,

}) => {

  useEffect(() => {

    const handleEsc = (e: KeyboardEvent) => {

      if (e.key === 'Escape') onClose();

    };

    window.addEventListener('keydown', handleEsc);

    return () => window.removeEventListener('keydown', handleEsc);

  }, [onClose]);



  if (!isOpen) return null;



  return (

    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">

      <div

        className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"

        onClick={onClose}

      >

        <div

          className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"

          aria-hidden="true"

        />



        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">

          &#8203;

        </span>



        <div

          className={`inline-block align-bottom bg-card border border-border rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full ${sizeClasses[size]}`}

          onClick={(e) => e.stopPropagation()}

        >

          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">

            <div className="sm:flex sm:items-start">

              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full min-w-0">

                <h3 className="text-base leading-6 font-semibold text-foreground" id="modal-title">

                  {title}

                </h3>

                <div

                  className={`mt-4 ${scrollable ? 'max-h-[min(70vh,640px)] overflow-y-auto pr-1 -mr-1' : ''}`}

                >

                  {children}

                </div>

              </div>

            </div>

          </div>

          <div className="bg-secondary/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-border">

            {footer || (

              <div className="flex justify-end w-full space-x-2">

                <Button variant="secondary" onClick={onClose}>

                  Close

                </Button>

              </div>

            )}

          </div>

        </div>

      </div>

    </div>

  );

};


