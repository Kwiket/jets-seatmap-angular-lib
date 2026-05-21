import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsDeckSeparatorComponent } from './jets-deck-separator.component';

describe('JetsDeckSeparatorComponent', () => {
  let fixture: ComponentFixture<JetsDeckSeparatorComponent>;
  let component: JetsDeckSeparatorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsDeckSeparatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsDeckSeparatorComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render with no colorTheme provided', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('should accept colorTheme.deckSeparation and not crash', () => {
    component.colorTheme = { deckSeparation: 80 } as any;
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
